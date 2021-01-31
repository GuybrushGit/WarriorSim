#include "simulation.h"
#include "bindings.h"
#include "talents.h"

Simulation::Simulation( Config& cfg, const Talents& talents )
    : timesecsmin( cfg.sim.timesecsmin )
    , timesecsmax( cfg.sim.timesecsmax )
    , executeperc( cfg.sim.executeperc )
    , startrage( cfg.sim.startrage )
    , iterations( cfg.sim.iterations )
    , batching( cfg.sim.batching )
    , priorityap( Execute::options.priorityap )
    , maxcallstack( std::min( cfg.sim.iterations / 10, 1000 ) )
    , player( *this, cfg, talents )
{
    for ( int dps = 0; dps < MAX_DPS; ++dps )
    {
        spread[dps] = 0;
    }
}

void Simulation::runAll()
{
    // TODO: why -1?
    for ( int iter = 1; iter <= iterations; ++iter )
    {
        run();
        if ( maxcallstack && iter % maxcallstack == 0 )
        {
            updateReport( iter, iterations, totaldmg, totalduration );
        }
    }
}

void Simulation::run()
{
    step = 0;
    idmg = 0;
    player.reset( ( double )startrage );
    maxsteps = rng( timesecsmin * 1000, timesecsmax * 1000 );
    executestep = maxsteps - maxsteps * executeperc / 100;

    int itemstep = maxsteps;
    int flaskstep = -1, cloudstep = -1, slayerstep = -1, spiderstep = -1, gabbarstep = -1, earthstep = -1, pummelstep = -1, zandalarstep = -1;
    if ( player.auras.has<Flask>() ) { itemstep -= 60000; flaskstep = std::max( itemstep, 0 ); }
    if ( player.auras.has<Cloudkeeper>() ) { itemstep -= 30000; cloudstep = std::max( itemstep, 0 ); }
    if ( player.auras.has<Slayer>() ) { itemstep -= 20000; slayerstep = std::max( itemstep, 0 ); }
    if ( player.auras.has<Spider>() ) { itemstep -= 15000; spiderstep = std::max( itemstep, 0 ); }
    if ( player.auras.has<Gabbar>() ) { itemstep -= 20000; gabbarstep = std::max( itemstep, 0 ); }
    if ( player.auras.has<Earthstrike>() ) { itemstep -= 20000; earthstep = std::max( itemstep, 0 ); }
    if ( player.auras.has<Pummeler>() ) { itemstep -= 30000; pummelstep = std::max( itemstep, 0 ); }
    if ( player.auras.has<Zandalarian>() ) { itemstep -= 20000; zandalarstep = std::max( itemstep, 0 ); }

    int next = 0;
    bool spellcheck = false;
    Castable* delayedspell = nullptr;
    Spell* delayedheroic = nullptr;

    while ( step < maxsteps )
    {
        // Passive ticks
        if ( next != 0 && step % 3000 == 0 && player.talents.angermanagement )
        {
            player.rage = std::min( player.rage + 1.0, 100.0 );
            spellcheck = true;
        }
        if ( player.vaelbuff && next != 0 && step % 1000 == 0 )
        {
            player.rage = std::min( player.rage + 20.0, 100.0 );
            spellcheck = true;
        }

        // Attacks
        if ( player.mh->timer <= 0 )
        {
            int dmg = player.attackmh( *player.mh );
            idmg += dmg;
            spellcheck = true;
        }
        if ( player.oh && player.oh->timer <= 0 )
        {
            int dmg = player.attackoh( *player.oh );
            idmg += dmg;
            spellcheck = true;
        }

        // Spells
        if ( spellcheck && !player.spelldelay )
        {
            // No GCD
            if ( auto* ptr = player.auras.ptr<Swarmguard>(); ptr && ptr->canUse() ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.auras.ptr<MightyRagePotion>(); ptr && ptr->canUse() ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.spells.ptr<Bloodrage>(); ptr && ptr->canUse() ) { player.spelldelay = 1; delayedspell = ptr; }

            // GCD spells
            else if ( player.timer ) {}
            else if ( auto* ptr = player.auras.ptr<Flask>(); ptr && ptr->canUse() && step > flaskstep ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.auras.ptr<Cloudkeeper>(); ptr && ptr->canUse() && step > cloudstep ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.auras.ptr<Recklessness>(); ptr && ptr->canUse() ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.auras.ptr<DeathWish>(); ptr && ptr->canUse() ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.auras.ptr<BloodFury>(); ptr && ptr->canUse() ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.auras.ptr<Berserking>(); ptr && ptr->canUse() ) { player.spelldelay = 1; delayedspell = ptr; }

            else if ( auto* ptr = player.auras.ptr<Slayer>(); ptr && ptr->canUse() && step > slayerstep ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.auras.ptr<Spider>(); ptr && ptr->canUse() && step > spiderstep ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.auras.ptr<Gabbar>(); ptr && ptr->canUse() && step > gabbarstep ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.auras.ptr<Earthstrike>(); ptr && ptr->canUse() && step > earthstep ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.auras.ptr<Pummeler>(); ptr && ptr->canUse() && step > pummelstep ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.auras.ptr<Zandalarian>(); ptr && ptr->canUse() && step > zandalarstep ) { player.spelldelay = 1; delayedspell = ptr; }

            // Execute phase
            else if ( auto* exe = player.spells.ptr<Execute>(); exe && step >= executestep )
            {
                if ( auto* ptr = player.spells.ptr<Bloodthirst>(); ptr && player.stats.ap >= priorityap && ptr->canUse() ) { player.spelldelay = 1; delayedspell = ptr; }
                else if ( auto* ptr = player.spells.ptr<MortalStrike>(); ptr && player.stats.ap >= priorityap && ptr->canUse() ) { player.spelldelay = 1; delayedspell = ptr; }
                else if ( exe->canUse() ) { player.spelldelay = 1; delayedspell = exe; }
            }

            // Normal phase
            else if ( auto* ptr = player.spells.ptr<SunderArmor>(); ptr && ptr->canUse() ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.spells.ptr<Bloodthirst>(); ptr && ptr->canUse() ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.spells.ptr<MortalStrike>(); ptr && ptr->canUse() ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.spells.ptr<Whirlwind>(); ptr && ptr->canUse() ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.spells.ptr<Overpower>(); ptr && ptr->canUse() ) { player.spelldelay = 1; delayedspell = ptr; }
            else if ( auto* ptr = player.spells.ptr<Hamstring>(); ptr && ptr->canUse() ) { player.spelldelay = 1; delayedspell = ptr; }

            if ( player.heroicdelay ) spellcheck = false;
        }

        // Heroic Strike
        if ( spellcheck && !player.heroicdelay )
        {
            if ( !player.spells.has<Execute>() || step < executestep )
            {
                if ( auto* ptr = player.spells.ptr<HeroicStrike>(); ptr && ptr->canUse() ) { player.heroicdelay = 1; delayedheroic = ptr; }
            }
            else
            {
                if ( auto* ptr = player.spells.ptr<HeroicStrikeExecute>(); ptr && ptr->canUse() ) { player.heroicdelay = 1; delayedheroic = ptr; }
            }

            spellcheck = false;
        }

        // Cast spells
        if ( player.spelldelay && delayedspell && player.spelldelay > delayedspell->maxdelay )
        {
            // Prevent casting HS and other spells at the exact same time
            if ( player.heroicdelay && delayedheroic && player.heroicdelay > delayedheroic->maxdelay )
            {
                player.heroicdelay = delayedheroic->maxdelay - 49;
            }
            if ( delayedspell->canUse() )
            {
                int dmg = player.cast( delayedspell );
                idmg += dmg;
                spellcheck = true;
            }
            player.spelldelay = 0;
        }

        // Cast HS
        if ( player.heroicdelay && delayedheroic && player.heroicdelay > delayedheroic->maxdelay )
        {
            if ( delayedheroic->canUse() )
            {
                player.cast( delayedheroic );
                spellcheck = true;
            }
            player.heroicdelay = 0;
        }

        // TODO: this always uses HS settings and ignores HS Execute
        if ( player.spells.has<HeroicStrike>() && HeroicStrike::options.unqueue && player.nextswinghs &&
             player.rage < HeroicStrike::options.unqueue && player.mh->timer < HeroicStrike::options.unqueuetimer )
        {
            player.nextswinghs = false;
        }

        // Extra attacks
        if ( player.extraattacks > 0 )
        {
            player.mh->timer = 0;
            player.extraattacks -= 1;
        }
        if ( player.batchedextras > 0 )
        {
            player.mh->timer = batching - ( step % batching );
            player.batchedextras -= 1;
        }

        // Process next step
        if ( !player.mh->timer || ( !player.spelldelay && spellcheck ) || ( !player.heroicdelay && spellcheck ) )
        {
            next = 0;
            continue;
        }

        next = player.mh->timer;
        if ( player.oh ) next = std::min( next, player.oh->timer );

        if ( player.spelldelay ) next = std::min( next, delayedspell->maxdelay - player.spelldelay + 1 );
        if ( player.heroicdelay ) next = std::min( next, delayedheroic->maxdelay - player.heroicdelay + 1 );
        if ( player.timer ) next = std::min( next, player.timer );
        if ( player.itemtimer ) next = std::min( next, player.itemtimer );
        if ( player.talents.angermanagement ) next = std::min( next, 3000 - step % 3000 );
        if ( player.vaelbuff ) next = std::min( next, 1000 - step % 1000 );
        if ( auto* ptr = player.auras.ptr<BloodrageAura>(); ptr && ptr->timer ) next = std::min( next, 1000 - ( step - ptr->starttimer ) % 1000 );
        if ( auto* ptr = player.auras.ptr<Gabbar>(); ptr && ptr->timer ) next = std::min( next, 2000 - ( step - ptr->starttimer ) % 2000 );

        if ( auto* ptr = player.spells.ptr<Bloodthirst>(); ptr && ptr->timer ) next = std::min( next, ptr->timer );
        if ( auto* ptr = player.spells.ptr<MortalStrike>(); ptr && ptr->timer ) next = std::min( next, ptr->timer );
        if ( auto* ptr = player.spells.ptr<Whirlwind>(); ptr && ptr->timer ) next = std::min( next, ptr->timer );
        if ( auto* ptr = player.spells.ptr<Bloodrage>(); ptr && ptr->timer ) next = std::min( next, ptr->timer );
        if ( auto* ptr = player.spells.ptr<Overpower>(); ptr && ptr->timer ) next = std::min( next, ptr->timer );
        if ( auto* ptr = player.spells.ptr<Execute>(); ptr && ptr->timer ) next = std::min( next, ptr->timer );

        if ( player.spells.has<HeroicStrike>() && HeroicStrike::options.unqueue )
        {
            int timeleft = player.mh->timer - HeroicStrike::options.unqueuetimer;
            if ( timeleft > 0 ) next = std::min( next, timeleft );
        }

        step += next;
        player.mh->step( next );
        if ( player.oh ) player.oh->step( next );
        if ( player.timer && player.steptimer( next ) && !player.spelldelay ) spellcheck = true;
        if ( player.itemtimer && player.stepitemtimer( next ) && !player.spelldelay ) spellcheck = true;
        if ( player.dodgetimer ) player.stepdodgetimer( next );
        if ( player.spelldelay ) player.spelldelay += next;
        if ( player.heroicdelay )  player.heroicdelay += next;

        if ( auto* ptr = player.spells.ptr<Bloodthirst>(); ptr && ptr->timer && !ptr->step( next ) && !player.spelldelay ) spellcheck = true;
        if ( auto* ptr = player.spells.ptr<MortalStrike>(); ptr && ptr->timer && !ptr->step( next ) && !player.spelldelay ) spellcheck = true;
        if ( auto* ptr = player.spells.ptr<Whirlwind>(); ptr && ptr->timer && !ptr->step( next ) && !player.spelldelay ) spellcheck = true;
        if ( auto* ptr = player.spells.ptr<Bloodrage>(); ptr && ptr->timer && !ptr->step( next ) && !player.spelldelay ) spellcheck = true;
        if ( auto* ptr = player.spells.ptr<Overpower>(); ptr && ptr->timer && !ptr->step( next ) && !player.spelldelay ) spellcheck = true;
        if ( auto* ptr = player.spells.ptr<Execute>(); ptr && ptr->timer && !ptr->step( next ) && !player.spelldelay ) spellcheck = true;

        if ( auto* ptr = player.auras.ptr<BloodrageAura>(); ptr && ptr->timer && !ptr->step() && !player.spelldelay ) spellcheck = true;
        if ( auto* ptr = player.auras.ptr<Gabbar>(); ptr && ptr->timer ) ptr->step();
    }

    player.endauras();

    //std::cout << "Total: " << idmg << std::endl;

    totaldmg += idmg;
    totalduration += maxsteps;

    double dps = 1000.0 * ( double )idmg / ( double )maxsteps;
    if ( dps < mindps ) mindps = dps;
    if ( dps > maxdps ) maxdps = dps;
    sumdps += dps;
    sumdps2 += dps * dps;
    int idps = int( dps + 0.5 );
    if ( idps < MAX_DPS )
    {
        spread[idps] += 1;
    }
}

void Simulation::report( bool full )
{
    if ( full )
    {
        player.auras.for_each( [=]( Aura& aura )
        {
            reportAura( aura, iterations, totalduration );
        } );
        player.spells.for_each( [=]( Spell& spell )
        {
            reportSpell( spell, iterations, totalduration );
        } );
        reportWeapon( false, *player.mh, iterations, totalduration );
        if ( player.oh )
        {
            reportWeapon( true, *player.oh, iterations, totalduration );
        }
        reportSpread( spread, MAX_DPS );
    }
    finalReport( iterations, totaldmg, totalduration, mindps, maxdps, sumdps, sumdps2 );
}
