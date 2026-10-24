using Microsoft.AspNetCore.Mvc;

namespace SmartHome.Controllers;

[ApiController]
[Route("api/analytics")]
public class AnalyticsController : ControllerBase
{
    // GET /api/analytics/energy-ranking?day=2026-10-24
    [HttpGet("energy-ranking")]
    public IActionResult EnergyRanking([FromQuery] string? day) => Ok(Array.Empty<object>());

    // GET /api/analytics/energy-comparison
    [HttpGet("energy-comparison")]
    public IActionResult EnergyComparison() => Ok(Array.Empty<object>());

    // GET /api/analytics/overview (iz plana, frontend ga za sada ne poziva)
    [HttpGet("overview")]
    public IActionResult Overview() => Ok(new { });
}