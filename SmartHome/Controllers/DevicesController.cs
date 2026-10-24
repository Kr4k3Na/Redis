using Microsoft.AspNetCore.Mvc;

namespace SmartHome.Controllers;

[ApiController]
[Route("api/devices")]
public class DevicesController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll() => Ok(Array.Empty<object>());
}