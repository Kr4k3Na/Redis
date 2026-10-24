using Microsoft.AspNetCore.Mvc;

namespace SmartHome.Controllers;

[ApiController]
[Route("api/alerts")]
public class AlertsController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll() => Ok(Array.Empty<object>());
}