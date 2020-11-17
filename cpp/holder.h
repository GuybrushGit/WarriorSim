#pragma once
#include <tuple>
#include <optional>

template<class... Types>
class Holder
{
public:
    template<class T>
    bool has() const
    {
        return std::get<std::optional<T>>( values_ ).has_value();
    }

    template<class T>
    T& get()
    {
        return std::get<std::optional<T>>( values_ ).value();
    }

    template<class T>
    const T& get() const
    {
        return std::get<std::optional<T>>( values_ ).value();
    }

    template<class T>
    T* ptr()
    {
        auto& opt = std::get<std::optional<T>>( values_ );
        return opt.has_value() ? &opt.value() : nullptr;
    }

    template<class T>
    const T* ptr() const
    {
        const auto& opt = std::get<std::optional<T>>( values_ );
        return opt.has_value() ? &opt.value() : nullptr;
    }

    template<class T>
    void erase()
    {
        std::get<std::optional<T>>( values_ ).reset();
    }

    template<class T, class... Args>
    T& emplace( Args&&... args )
    {
        return std::get<std::optional<T>>( values_ ).emplace( std::forward<Args>( args )... );
    }

    template<class T, class U, class... Args, typename = std::enable_if_t<std::is_constructible_v<T, std::initializer_list<U>&, Args...>>>
    T& emplace( std::initializer_list<U> list, Args&&... args )
    {
        return std::get<std::optional<T>>( values_ ).emplace( list, std::forward<Args>( args )... );
    }

    template<class Func>
    void for_each( Func func )
    {
        auto funcEx = [&]( auto& opt )
        {
            if ( opt.has_value() )
            {
                func( opt.value() );
            }
            return 0;
        };
        ( funcEx( std::get<std::optional<Types>>( values_ ) ), ... );
    }

private:
    std::tuple<std::optional<Types>...> values_;
};
