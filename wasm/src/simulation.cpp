#include "engine.hpp"

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <string_view>
#include <vector>

namespace warriorsim {
namespace {

struct Action {
    SpellState* spell = nullptr;
    AuraState* aura = nullptr;

    explicit operator bool() const { return spell || aura; }
    double maxDelay() const { return spell ? spell->maxdelay : aura ? aura->maxdelay : 0; }
};

bool canUse(PlayerState& player, const Action& action) {
    return action.spell ? spellCanUse(player, *action.spell) :
           action.aura ? auraCanUse(player, *action.aura) : false;
}

void use(PlayerState& player, const Action& action, SpellState* delayedHeroic = nullptr) {
    if (action.spell) player.cast(*action.spell, delayedHeroic);
    else if (action.aura) auraUse(player, *action.aura);
}

Action findAction(PlayerState& player, detail::KnownAction key, bool isAura) {
    return isAura ? Action{nullptr, player.aura(key)} : Action{player.spell(key), nullptr};
}

Action findAction(PlayerState& player, int index, bool isAura) {
    return isAura
        ? Action{nullptr, &player.auras[static_cast<std::size_t>(index)]}
        : Action{&player.spells[static_cast<std::size_t>(index)], nullptr};
}

bool choose(PlayerState& player, Action& result, detail::KnownAction key, bool isAura) {
    const Action candidate = findAction(player, key, isAura);
    if (candidate && canUse(player, candidate)) { result = candidate; return true; }
    return false;
}

bool choose(PlayerState& player, Action& result, int index, bool isAura) {
    const Action candidate = findAction(player, index, isAura);
    if (canUse(player, candidate)) { result = candidate; return true; }
    return false;
}

bool consumedRageBlocked(PlayerState& player) {
    const auto* consumed = player.aura("consumedrage"_action);
    if (!consumed) return false;
    if (consumed->props.boolean("procblock"_prop) && !consumed->timer && player.rage < 60) return true;
    if (consumed->props.number("rageblock"_prop) && player.rage < consumed->props.number("rageblock"_prop)) return true;
    return consumed->props.number("chargeblock"_prop) && consumed->stacks < consumed->props.number("chargeblock"_prop) && player.rage < 60;
}

double positiveModulo(double value, double divisor) {
    if (!divisor) return 0;
    double result = detail::jsRemainder(value, divisor);
    return result < 0 ? result + divisor : result;
}

void minPositive(double candidate, double& current) {
    if (candidate < current) current = candidate;
}

void periodicCandidate(PlayerState& player, int index, double interval,
                       double& next) {
    const auto& value = player.auras[static_cast<std::size_t>(index)];
    if (!value.timer) return;
    minPositive(interval - positiveModulo(player.step - value.starttimer, interval), next);
}

void nextTickCandidate(PlayerState& player, int index, double& next) {
    const auto& value = player.auras[static_cast<std::size_t>(index)];
    if (value.timer) minPositive(value.nexttick - player.step, next);
}

void absoluteAuraCandidate(PlayerState& player, int index, double& next) {
    const auto& value = player.auras[static_cast<std::size_t>(index)];
    if (value.timer) minPositive(value.timer - player.step, next);
}

void spellTimerCandidate(PlayerState& player, int index, double& next) {
    const auto& value = player.spells[static_cast<std::size_t>(index)];
    if (value.timer) minPositive(value.timer, next);
}

} // namespace

double Engine::runOne(std::uint32_t globalIteration, double& duration) {
    player_.rng.seed(baseSeed_ + globalIteration * 0x9e3779b9u);
    player_.step = 0;
    player_.reset(sim_.startrage);
    const double maxSteps = player_.rng.integer(sim_.timesecsmin * 1000.0, sim_.timesecsmax * 1000.0);
    duration = maxSteps / 1000.0;
    const double executeStep = maxSteps - static_cast<std::int32_t>(maxSteps * (sim_.executeperc / 100.0));
    if (auto* execute = player_.spell("execute"_action)) execute->executestep = executeStep;

    double itemDelay = 0;
    for (const auto [isAura, index] : player_.prepOrder) {
        if (isAura) itemDelay += auraPrep(player_, player_.auras[static_cast<std::size_t>(index)], maxSteps, itemDelay);
        else spellPrep(player_, player_.spells[static_cast<std::size_t>(index)], static_cast<int>(maxSteps));
    }
    int bloodrageSelection = player_.configured.bloodrageSelection;
    if (bloodrageSelection != kNoRef) {
        const auto& bloodrage = player_.spells[static_cast<std::size_t>(bloodrageSelection)];
        if (bloodrage.kind == SpellKind::Bloodrage && std::isnan(bloodrage.useStep))
            bloodrageSelection = kNoRef;
    }
    std::vector<AuraState*> prepull;
    for (auto& value : player_.auras) if (value.useStep < 0) prepull.push_back(&value);
    std::stable_sort(prepull.begin(), prepull.end(), [](const AuraState* lhs, const AuraState* rhs) {
        return lhs->useStep > rhs->useStep;
    });
    int counter = 1500;
    for (auto* value : prepull) {
        if (auraCanUse(player_, *value)) {
            auraUse(player_, *value, false, counter);
            counter += 1500;
            player_.timer = player_.itemtimer = 0;
        }
    }
    if (auto* shout = player_.aura("battleshout"_action)) auraUse(player_, *shout, true);
    player_.timer = 0;

    double damage = 0;
    Action delayedSpell;
    SpellState* delayedHeroic = nullptr;
    bool spellcheck = false;
    bool canSpellQueue = false;
    double next = 0;
    double slamStep = 0;
    std::uint64_t loopGuard = 0;

    while (player_.step < maxSteps) {
        if (++loopGuard > 10000000) throw std::runtime_error("simulation event loop made no progress");
        if (next != 0 && player_.talents.number("angermanagement"_prop) &&
            positiveModulo(player_.step, 3000) == 0) {
            player_.rage = player_.rage >= 99 ? 100 : player_.rage + 1;
            spellcheck = true;
            if (auto* consumed = player_.aura("consumedrage"_action); consumed && player_.rage >= 60 && player_.rage < 81)
                auraUse(player_, *consumed);
        }
        if (player_.flag("vaelbuff"_prop) && next != 0 && positiveModulo(player_.step, 1000) == 0) {
            player_.rage = player_.rage >= 60 ? 100 : player_.rage + 20;
            spellcheck = true;
            if (auto* consumed = player_.aura("consumedrage"_action); consumed && player_.rage >= 60)
                auraUse(player_, *consumed);
        }
        if (auto* molten = player_.spell("themoltencore"_action); molten && next != 0 &&
            positiveModulo(player_.step, 2000) == 0) spellUse(player_, *molten);

        const double targetSpeed = player_.target.props.number("speed"_prop);
        if (targetSpeed && positiveModulo(player_.step, targetSpeed) == 0) {
            const double oldRage = player_.rage;
            const double incoming = player_.rng.integer(player_.target.props.number("mindmg"_prop),
                                                        player_.target.props.number("maxdmg"_prop));
            player_.rage = std::min(player_.rage + incoming / player_.prop("rageconversion"_prop) * 2.5, 100.0);
            spellcheck = true;
            if (auto* consumed = player_.aura("consumedrage"_action); consumed && player_.rage >= 60 && oldRage < 60)
                auraUse(player_, *consumed);
        }

        if (!slamStep) {
            if (player_.mh.timer <= 0) { damage += player_.attackMh(player_.mh); spellcheck = true; }
            if (player_.oh && player_.oh->timer <= 0) { damage += player_.attackOh(*player_.oh); spellcheck = true; }

            if (spellcheck && !player_.spelldelay) {
                delayedSpell = {};
                // This order is combat behavior: preserve the JavaScript else-if chain.
                for (const int index : player_.configured.noGcdAuras)
                    if (choose(player_, delayedSpell, index, true)) break;
                if (!delayedSpell) {
                    for (const int index : player_.configured.noGcdSpells)
                        if (choose(player_, delayedSpell, index, false)) break;
                }
                if (!delayedSpell) {
                    for (const int index : player_.configured.moreNoGcdAuras)
                        if (choose(player_, delayedSpell, index, true)) break;
                }
                if (!delayedSpell) choose(player_, delayedSpell, "grilekfury"_action, false);

                if (!delayedSpell && !player_.timer) {
                    if (auto* value = player_.spell("berserkerrage"_action); value && value->props.boolean("zerkerpriority"_prop) &&
                        spellCanUse(player_, *value)) delayedSpell.spell = value;
                }
                if (!delayedSpell && bloodrageSelection != kNoRef)
                    choose(player_, delayedSpell, bloodrageSelection, false);
                if (!delayedSpell) {
                    for (const int index : player_.configured.onUseAuras)
                        if (choose(player_, delayedSpell, index, true)) break;
                }
                if (!delayedSpell && player_.configured.unstoppableMightSelection != kNoRef)
                    choose(player_, delayedSpell, player_.configured.unstoppableMightSelection, false);
                if (!delayedSpell && player_.configured.stanceSwitchSelection != kNoRef)
                    choose(player_, delayedSpell, player_.configured.stanceSwitchSelection, false);
                if (!delayedSpell && player_.timer) {
                    // Deliberately leave empty, matching the JS branch that blocks GCD actions.
                } else if (!delayedSpell) choose(player_, delayedSpell, "victoryrush"_action, false);
                if (!delayedSpell && !player_.timer) choose(player_, delayedSpell, "flask"_action, true);
                if (!delayedSpell && !player_.timer) choose(player_, delayedSpell, "recklessness"_action, true);
                if (!delayedSpell && !player_.timer) choose(player_, delayedSpell, "deathwish"_action, true);
                if (!delayedSpell && !player_.timer) choose(player_, delayedSpell, "bloodfury"_action, true);
                if (!delayedSpell && !player_.timer) choose(player_, delayedSpell, "berserking"_action, true);
                if (!delayedSpell && !player_.timer) choose(player_, delayedSpell, "berserkerrage"_action, false);
                if (!delayedSpell && !player_.timer) choose(player_, delayedSpell, "battleshout"_action, true);
                if (!delayedSpell && !player_.timer) choose(player_, delayedSpell, "blademasterfury"_action, false);

                if (!delayedSpell && !player_.timer && !consumedRageBlocked(player_)) {
                    const auto& priority = player_.step >= executeStep ? player_.executeSpells : player_.normalSpells;
                    for (const auto [isAura, index] : priority) {
                        if (isAura) {
                            auto& value = player_.auras[static_cast<std::size_t>(index)];
                            if (auraCanUse(player_, value)) { delayedSpell.aura = &value; break; }
                        } else {
                            auto& value = player_.spells[static_cast<std::size_t>(index)];
                            if (spellCanUse(player_, value)) { delayedSpell.spell = &value; break; }
                        }
                    }
                }
                if (delayedSpell) { player_.spelldelay = 1; }
                if (player_.heroicdelay) spellcheck = false;
            }

            if (spellcheck && !player_.heroicdelay) {
                const auto* execute = player_.spell("execute"_action);
                const auto* sudden = player_.aura("suddendeath"_action);
                if (!execute || (player_.step < executeStep && (!sudden || !sudden->timer))) {
                    if (!consumedRageBlocked(player_)) {
                        if (auto* heroic = player_.spell("heroicstrike"_action); heroic && spellCanUse(player_, *heroic)) {
                            player_.heroicdelay = 1; delayedHeroic = heroic;
                        } else if (auto* cleave = player_.spell("cleave"_action); cleave && spellCanUse(player_, *cleave)) {
                            player_.heroicdelay = 1; delayedHeroic = cleave;
                        }
                    }
                }
                spellcheck = false;
            }

            if (player_.spelldelay && delayedSpell &&
                (canSpellQueue || player_.spelldelay > delayedSpell.maxDelay())) {
                if (player_.heroicdelay && delayedHeroic && player_.heroicdelay > delayedHeroic->maxdelay)
                    player_.heroicdelay = delayedHeroic->maxdelay - 99;
                if (canUse(player_, delayedSpell)) {
                    if (delayedSpell.spell && delayedSpell.spell->kind == SpellKind::Slam) {
                        auto& slam = *delayedSpell.spell;
                        const double casttime = slam.props.number("casttime"_prop);
                        slamStep = player_.freeslam ? player_.step : player_.step + casttime;
                        player_.timer = 1500;
                        player_.heroicdelay = 0;
                        player_.nextswinghs = false;
                        next = 0;
                        continue;
                    }
                    double done = 0;
                    if (delayedSpell.spell) done = player_.cast(*delayedSpell.spell, delayedHeroic);
                    else { player_.stepAuras(); auraUse(player_, *delayedSpell.aura); done = 0; }
                    damage += done;
                    player_.spelldelay = 0;
                    spellcheck = true;
                    if (delayedSpell.spell && delayedSpell.spell->offhandhit && player_.oh) {
                        done = player_.castOh(*delayedSpell.spell);
                        damage += done;
                    }
                    if (delayedSpell.spell &&
                        (delayedSpell.spell->kind == SpellKind::Whirlwind ||
                         delayedSpell.spell->kind == SpellKind::BlademasterFury ||
                         delayedSpell.spell->kind == SpellKind::ThunderClap ||
                         delayedSpell.spell->kind == SpellKind::Shockwave)) {
                        for (int i = 0; i < player_.prop("adjacent"_prop); ++i) {
                            done = player_.cast(*delayedSpell.spell, delayedHeroic,
                                                static_cast<int>(player_.prop("adjacent"_prop)), done);
                            damage += done;
                            if (delayedSpell.spell->offhandhit && player_.oh) {
                                done = player_.castOh(*delayedSpell.spell,
                                    static_cast<int>(player_.prop("adjacent"_prop)), done);
                                damage += done;
                            }
                        }
                    }
                } else player_.spelldelay = 0;
            }

            if (player_.heroicdelay && delayedHeroic && player_.heroicdelay > delayedHeroic->maxdelay) {
                if (spellCanUse(player_, *delayedHeroic)) {
                    player_.cast(*delayedHeroic);
                    player_.heroicdelay = 0;
                    spellcheck = true;
                } else player_.heroicdelay = 0;
            }

            const auto* execute = player_.spell("execute"_action);
            const auto* sudden = player_.aura("suddendeath"_action);
            if (!execute || (player_.step < executeStep && (!sudden || !sudden->timer))) {
                for (const int index : player_.configured.queuedStrikes) {
                    auto* value = &player_.spells[static_cast<std::size_t>(index)];
                    if (value->props.number("unqueue"_prop) && player_.nextswinghs &&
                        player_.rage < value->props.number("unqueue"_prop) &&
                        player_.mh.timer <= value->props.number("unqueuetimer"_prop)) {
                        player_.nextswinghs = false;
                        break;
                    }
                }
            }
        }

        if (slamStep && player_.step == slamStep && delayedSpell.spell) {
            double done = player_.cast(*delayedSpell.spell, delayedHeroic);
            damage += done;
            if (delayedSpell.spell->offhandhit && player_.oh) damage += player_.castOh(*delayedSpell.spell);
            spellcheck = true;
            slamStep = 0;
        }
        if (player_.extraattacks > 0) {
            player_.mh.timer = 0;
            --player_.extraattacks;
        }
        if (player_.batchedextras > 0) {
            const double batching = sim_.batching;
            player_.mh.timer = batching - positiveModulo(player_.step, batching);
            --player_.batchedextras;
        }

        if (!slamStep) {
            if (!player_.mh.timer || (!player_.spelldelay && spellcheck) || (!player_.heroicdelay && spellcheck)) {
                next = 0;
                continue;
            }
            next = std::min(player_.mh.timer, player_.oh ? player_.oh->timer : 9999.0);
            if (player_.spelldelay && delayedSpell && delayedSpell.maxDelay() - player_.spelldelay < next)
                next = delayedSpell.maxDelay() - player_.spelldelay + 1;
            if (player_.heroicdelay && delayedHeroic && delayedHeroic->maxdelay - player_.heroicdelay < next)
                next = delayedHeroic->maxdelay - player_.heroicdelay + 1;
        } else next = slamStep - player_.step;

        if (player_.timer && player_.timer < next) next = player_.timer;
        if (player_.itemtimer && player_.itemtimer < next) next = player_.itemtimer;
        if (player_.stancetimer && player_.stancetimer < next) next = player_.stancetimer;
        if (player_.ragetimer && player_.ragetimer < next) next = player_.ragetimer;
        if (targetSpeed) minPositive(targetSpeed - positiveModulo(player_.step, targetSpeed), next);
        if (player_.talents.number("angermanagement"_prop)) minPositive(3000 - positiveModulo(player_.step, 3000), next);
        if (player_.flag("vaelbuff"_prop)) minPositive(1000 - positiveModulo(player_.step, 1000), next);
        if (player_.spell("themoltencore"_action)) minPositive(2000 - positiveModulo(player_.step, 2000), next);
        for (const auto& candidate : player_.configured.periodicCandidates)
            periodicCandidate(player_, candidate.index, candidate.interval, next);
        for (const int index : player_.configured.tickAuras)
            nextTickCandidate(player_, index, next);
        for (const int index : player_.configured.weaponBleeds) {
            const auto& value = player_.auras[static_cast<std::size_t>(index)];
            if (value.timer)
                periodicCandidate(player_, index, value.props.number("interval"_prop), next);
        }
        for (const int index : player_.configured.timedSpells)
            spellTimerCandidate(player_, index, next);
        for (const int index : player_.configured.absoluteAuras)
            absoluteAuraCandidate(player_, index, next);
        const auto* executeAtEvent = player_.spell("execute"_action);
        const auto* suddenAtEvent = player_.aura("suddendeath"_action);
        if (!executeAtEvent || (player_.step < executeStep && (!suddenAtEvent || !suddenAtEvent->timer))) {
            for (const int index : player_.configured.queuedStrikes) {
                const auto& value = player_.spells[static_cast<std::size_t>(index)];
                if (value.props.number("unqueue"_prop)) {
                    const double timeleft = player_.mh.timer - value.props.number("unqueuetimer"_prop);
                    if (timeleft > 0 && timeleft < next) next = timeleft;
                    break;
                }
            }
        }

        if (!(next >= 0) || !std::isfinite(next)) throw std::runtime_error("invalid next simulation event time");
        player_.step += next;
        if (player_.step > maxSteps) break;
        player_.mh.timer -= next;
        if (player_.oh) player_.oh->timer -= next;
        canSpellQueue = false;
        if (player_.timer && player_.stepTimer(next) && !player_.spelldelay) {
            spellcheck = true;
            canSpellQueue = player_.flag("spellqueueing"_prop);
        }
        if (player_.itemtimer && player_.stepItemTimer(next) && !player_.spelldelay) spellcheck = true;
        if (player_.stancetimer && player_.stepStanceTimer(next) && !player_.spelldelay) spellcheck = true;
        if (player_.ragetimer) player_.stepRageTimer(next);
        if (player_.dodgetimer) player_.stepDodgeTimer(next);
        if (player_.spelldelay) player_.spelldelay += next;
        if (player_.heroicdelay) player_.heroicdelay += next;

        for (const int index : player_.configured.stepSpells) {
            auto& value = player_.spells[static_cast<std::size_t>(index)];
            if (value.timer && !spellStep(player_, value, next) && !player_.spelldelay)
                spellcheck = true;
        }

        // BloodrageAura.step() is the one periodic aura step that explicitly
        // returns its timer. JS therefore requests a spell check only when it
        // expires; the other periodic Aura.step overrides return undefined.
        if (auto* bloodrage = player_.aura("bloodrage"_action); bloodrage && bloodrage->timer) {
            const bool remainsActive = auraStep(player_, *bloodrage);
            if (!remainsActive && !player_.spelldelay) spellcheck = true;
        }
        if (auto* gabbar = player_.aura("gabbar"_action); gabbar && gabbar->timer) (void)auraStep(player_, *gabbar);
        for (const int index : player_.configured.periodicAuras) {
            auto& value = player_.auras[static_cast<std::size_t>(index)];
            if (!value.timer) continue;
            (void)auraStep(player_, value);
            if (!player_.spelldelay) spellcheck = true; // JS Aura.step returns undefined.
        }
        for (const int index : player_.configured.absoluteAuras) {
            auto& value = player_.auras[static_cast<std::size_t>(index)];
            if (!value.timer) continue;
            (void)auraStep(player_, value);
            if (!player_.spelldelay) spellcheck = true;
        }
    }

    player_.endAuras();
    for (const int index : player_.configured.finalAuras)
        damage += player_.auras[static_cast<std::size_t>(index)].idmg;
    for (const int index : player_.configured.finalSpells)
        damage += player_.spells[static_cast<std::size_t>(index)].idmg;
    return damage;
}

} // namespace warriorsim
