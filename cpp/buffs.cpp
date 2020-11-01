#include "buffs.h"

Buff buff_list[] =
{
  {   2458, {   0,   0,   0, 3, 0,  0,  0,  0,  0,  0, 0 } }, // Berserker Stance
  {  27578, {   0,   0, 193, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Battle Shout
  {  23563, {   0,   0, 223, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Enhanced Battle Shout
  {  22888, {   0,   0, 140, 5, 0, 10,  0,  0,  0,  0, 0 } }, // Rallying Cry of the Dragonslayer
  {  24425, {   0,   0,   0, 0, 0,  0, 15, 15,  0,  0, 0 } }, // Spirit of Zandalar
  {  23768, {   0,   0,   0, 0, 0,  0,  0,  0, 10,  0, 0 } }, // Sayge's Dark Fortune of Damage
  {  22817, {   0,   0, 200, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Fengus' Ferocity
  {  22820, {   0,   0,   0, 0, 0,  3,  0,  0,  0,  0, 0 } }, // Slip'kik's Savvy
  {  15366, {  15,  15,   0, 5, 0,  5,  0,  0,  0,  0, 0 } }, // Songflower Serenade
  {  16609, {   0,   0,   0, 0, 0,  0,  0,  0,  0, 15, 0 } }, // Warchief's Blessing
  {  17007, {   0,   0,   0, 3, 0,  0,  0,  0,  0,  0, 0 } }, // Leader of the Pack
  {   9885, {  16,  16,   0, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Mark of the Wild
  {  20906, {   0,   0, 100, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Trueshot Aura
  {  20217, {   0,   0,   0, 0, 0,  0, 10, 10,  0,  0, 0 } }, // Blessing of Kings
  {  19838, {   0,   0, 186, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Blessing of Might
  {  10614, {   0,   0,   0, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Windfury Totem
  {  10627, {   0,  67,   0, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Grace of Air Totem
  {  10442, {  61,   0,   0, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Strength of Earth Totem
  {   8410, {  25,   0,   0, 0, 0,  0,  0,  0,  0,  0, 0 } }, // R.O.I.D.S.
  {   8412, {   0,  25,   0, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Ground Scorpok Assay
  {  13452, {   0,  25,   0, 2, 0,  0,  0,  0,  0,  0, 0 } }, // Elixir of the Mongoose
  {   9187, {   0,  25,   0, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Elixir of Greater Agility
  {  12451, {  30,   0,   0, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Juju Power
  {   9206, {  25,   0,   0, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Elixir of Giants
  {  12460, {   0,   0,  40, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Juju Might
  {  12820, {   0,   0,  35, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Winterfall Firewater
  {  20452, {  20,   0,   0, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Smoked Desert Dumplings
  {  13928, {   0,  10,   0, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Grilled Squid
  {  13810, {  10,   0,   0, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Blessed Sunfruit
  {   5206, {   0,   0,   0, 0, 0,  0,  0,  0,  0,  0, 1 } }, // Bogling Root
  {  22237, {   0,   0,   0, 0, 2,  0,  0,  0,  0,  0, 0 } }, // Dark Desire
  {  23327, {   0,   0,   0, 0, 2,  0,  0,  0,  0,  0, 0 } }, // Fire-toasted Bun
  {  23513, {   0,   0,   0, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Essence of the Red
  {  12217, {   0,   0,   0, 0, 0,  0,  0,  0,  0,  0, 0 } }, // Dragonbreath Chili
  {  29338, {   0,   0,   0, 3, 0,  3,  0,  0,  0,  0, 0 } }, // Fire Festival Fury
};

static_vector<Buff> Buffs = buff_list;
