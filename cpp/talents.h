#pragma once

struct Talents
{
    int impheroicstrike = 0;
    int parry = 0;
    int rendmod = 0;
    int chargebonus = 0;
    int rageretained = 0;
    int impthunderclap = 0;
    int overpowercrit = 0;
    int angermanagement = 0;
    double deepwounds = 0;
    double twomod = 0;
    double abilitiescrit = 0;
    int axecrit = 0;
    int sweepingstrikes = 0;
    int macestun = 0;
    int swordproc = 0;
    int polearmcrit = 0;
    int imphamstring = 0;
    int mortalstrike = 0;

    double boomingvoice = 0;
    int crit = 0;
    int impdemoshout = 0;
    int unbridledwrath = 0;
    int cleavebonus = 0;
    int piercinghowl = 0;
    int bloodcraze = 0;
    double impbattleshout = 0;
    double offmod = 0;
    int executecost = 0;
    int enrage = 0;
    int impslam = 0;
    int deathwish = 0;
    int impintercept = 0;
    int berserkerbonus = 0;
    int flurry = 0;
    int bloodthirst = 0;

    int block = 0;
    int blockragechance = 0;
    int defense = 0;
    int bloodragebonus = 0;
    int armormod = 0;
    int stunresist = 0;
    int laststand = 0;
    int extrablock = 0;
    int imprevenge = 0;
    int threatmod = 0;
    int impsunderarmor = 0;
    int impdisarm = 0;
    int imptaunt = 0;
    int impshieldwall = 0;
    int concussionblow = 0;
    int impshieldbash = 0;
    double onemod = 0;
    int shieldslam = 0;

    void add( int i, int count )
    {
        switch ( i )
        {
        case 124: impheroicstrike = count; break;
        case 130: parry = count; break;
        case 127: rendmod = 5 + count * 10; break;
        case 126: chargebonus = count * 3; break;
        case 641: rageretained = count * 5; break;
        case 128: impthunderclap = 1 << ( count - 1 ); break;
        case 131: overpowercrit = count * 25; break;
        case 137: angermanagement = count; break;
        case 121: deepwounds = double( count ) * 0.2; break;
        case 136: twomod = double( count ) * 0.01; break;
        case 662: abilitiescrit = double( count ) * 0.1; break;
        case 132: axecrit = count; break;
        case 133: sweepingstrikes = count; break;
        case 125: macestun = count == 5 ? 6 : count; break;
        case 123: swordproc = count; break;
        case 134: polearmcrit = count; break;
        case 129: imphamstring = count * 5; break;
        case 135: mortalstrike = count; break;

        case 158: boomingvoice = double( count ) * 0.1; break;
        case 157: crit = count; break;
        case 161: impdemoshout = count * 8; break;
        case 159: unbridledwrath = count * 8; break;
        case 166: cleavebonus = count * 40; break;
        case 160: piercinghowl = count; break;
        case 661: bloodcraze = count; break;
        case 154: impbattleshout = double( count ) * 0.05; break;
        case 1581: offmod = double( count ) * 0.05; break;
        case 1542: executecost = count == 2 ? 5 : count * 2; break;
        case 155: enrage = count * 5; break;
        case 168: impslam = count; break;
        case 165: deathwish = count; break;
        case 1543: impintercept = count * 5; break;
        case 1541: berserkerbonus = count * 5; break;
        case 156: flurry = count == 0 ? 0 : 5 + count * 5; break;
        case 167: bloodthirst = count; break;

        case 1601: block = count; blockragechance = count * 20; break;
        case 138: defense = count * 2; break;
        case 142: bloodragebonus = count == 2 ? 5 : count * 2; break;
        case 140: armormod = count * 2; break;
        case 141: stunresist = count * 3; break;
        case 153: laststand = count; break;
        case 145: extrablock = count; break;
        case 147: imprevenge = count * 15; break;
        case 144: threatmod = count * 3; break;
        case 146: impsunderarmor = count; break;
        case 151: impdisarm = count; break;
        case 143: imptaunt = count; break;
        case 150: impshieldwall = count == 2 ? 5 : count * 3; break;
        case 152: concussionblow = count; break;
        case 149: impshieldbash = count * 50; break;
        case 702: onemod = double( count ) * 0.02; break;
        case 148: shieldslam = count; break;
        }
    }
};
