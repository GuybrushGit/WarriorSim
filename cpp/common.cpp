#include <stdint.h>
#include <random>
#include "common.h"

struct XorShiftGenerator
{
    using result_type = uint64_t;

    static constexpr uint64_t min()
    {
        return std::numeric_limits<uint64_t>::min();
    }

    static constexpr uint64_t max()
    {
        return std::numeric_limits<uint64_t>::max();
    }

    uint64_t state0 = 1;
    uint64_t state1 = 2;

    uint64_t operator()()
    {
        uint64_t s1 = state0;
        uint64_t s0 = state1;
        state0 = s0;
        s1 ^= s1 << 23;
        s1 ^= s1 >> 17;
        s1 ^= s0;
        s1 ^= s0 >> 26;
        state1 = s1;
        return state0 + state1;
    }
};

XorShiftGenerator generator;
std::uniform_real_distribution real_dist( 0.0, 1.0 );

void seedrng( uint64_t a, uint64_t b )
{
    generator.state0 = a;
    generator.state1 = b;
}

double randreal()
{
    return real_dist( generator );
}

int rng( int min, int max )
{
    return std::uniform_int_distribution( min, max )( generator );
}

int rng10k()
{
    return rng( 0, 9999 );
}
