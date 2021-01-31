#pragma once
#include "common.h"
#include "player.h"

struct Simulation
{
    int timesecsmin;
    int timesecsmax;
    int executeperc;
    int startrage;
    int iterations;
    int priorityap;
    int batching;

    uint64_t totaldmg = 0;
    uint64_t totalduration = 0;
    double mindps = 99999;
    double maxdps = 0;
    double sumdps = 0;
    double sumdps2 = 0;

    int maxcallstack;

    int step = 0;
    int idmg = 0;
    int maxsteps;
    int executestep;

    enum { MAX_DPS = 4096 };
    int spread[4096];

    Player player;

    Simulation( Config& cfg, const Talents& talents );

    void runAll();
    void run();
    void report( bool full );
};
