using StackExchange.Redis;

public static class RedisConfig
{
    public static IServiceCollection AddRedis(
        this IServiceCollection services, IConfiguration configuration)
    {
        var settings = configuration.GetSection("Redis").Get<RedisSettings>() ?? new RedisSettings();
        var options = ConfigurationOptions.Parse(settings.ConnectionString);

        options.AbortOnConnectFail = false;
        services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(options));
        services.AddSingleton(sp => sp.GetRequiredService<IConnectionMultiplexer>().GetDatabase());
        return services;
    }
}

public class RedisSettings
{
    public string ConnectionString { get; set; } = "localhost:6379";
}