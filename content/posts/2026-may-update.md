---
title: "Brave Puffin May 2026 update"
date: 2026-05-02
---

A follow-up to the [January update](/posts/2026-january-update)

### Servo based rudder

While I did finish building and testing a worm gear based rudder:

![Brave Puffin 2026 PCB](/img/2026-rudder-worm-cad.jpg#medium)

I eventually ditched it. It is just too bulky and complex.

My original thinking was that the worm gear would provide energy savings. It should require positioning rarely, and it will just stay locked - no power spent.

In reality, it will likely need frequent adjustments due to wind and wave action anyway. The efficiency losses in the worm gear are non-trivial, and so is the weight, and so is the mechanical complexity.

Servo based steering is not without its gotchas, but overall is simpler and lighter.

![Brave Puffin 2026 Rudder](/img/2026-rudder.jpg#small)

For the servo to rudder post linkage I went the simplest possible route: direct co-axial connection. Power consumption seems very acceptable, even with the external forces on the rudder. I have yet to test it in the ocean, though.

### A new PCB

I designed and manufactured (via JLCPCB) a brand new PCB for the 2026 season.

![Brave Puffin 2026 PCB](/img/2026-pcb-kicad.jpg#medium)

It's a major upgrade:
* All of the sensors are now on the PCB: voltage, current, compass, temperature, pressure, humidity
* A GPS module is also now on the PCB - the latest NEO-M9N chip
* An LTE modem SIM7080G is on the PCB as well - for near-shore comms and OTA updates
* A robust DC-DC buck converter is on the PCB too - to power the electronics and the servo, with a backup option
* An SD card slot is directly on the PCB for telemetry & logs

I was pleasantly surprised when all these components just worked!

![Brave Puffin 2026 PCB](/img/2026-pcb.jpg#medium)

Still relying on Iridium RockBlock module (not shown) for offshore satellite comms. Still using a breakout ESP32 module - not worth PCB onboarding, in my opinion.

I am really looking forward to being able to update the firmware OTA over LTE when testing near-shore. Iridium, of course, is too expensive for offshore OTA, and there's just not enough space for Starlink.

Mid to long term, I am closely tracking the availability of "3GPP Release 17 NB-NTN" modems. In 2025 when I was designing the PCB, they were hard to come by. Soon, it should be possible to just have one LTE modem working in cell or satellite mode, over the same service & plan.

### A dedicated, custom made remote

I found it to be very useful to control the boat in RC mode while testing. Previously I was just using a Bluetooth protocol and a phone. It is OK but not great: the range and usability are limited. In the past I also used off the shelf RC joystick remotes. The range is good, but they are just too basic. I wanted a remote that can work in 100m+ range, show boat's major telemetry data, support PID tuning, and control not just the speed and direction but also operation modes, waypoint setting, etc.

![Brave Puffin 2026 PCB](/img/2026-remote.jpg#medium)

So I built a custom remote. It's an off the shelf e-ink display + ESP32 module + a bunch of buttons. The cool thing is that ESP32 has ESP-NOW protocol, allowing two ESP32s to talk over a WiFi, essentially. The boat's ESP32 broadcasts telemetry to the remote, and remote's ESP32 sends commands to the boat. Another cool thing is that you can encrypt this data link.

### An ultrasonic wind sensor

Yes, Puffin 2026 will be able to measure wind speed and direction. The costs and physical dimensions of the ultrasonic wind sensors have fallen sharply over the years. They are now affordable, relatively easy to integrate, do not consume much power or space. And, one day, I'd like to try a hybrid solar + sail propulsion. (Hence the switch to a single propeller + rudder in 2026). We'll see how it will hold up in the water though - I am mounting it kind of low - the salt buildup could be an issue.

![Brave Puffin 2026 PCB](/img/2026-wind-sensor.jpg#medium)

### 2026 plans

Warm weather is almost here in Boston. I should be ready to start testing in May, unlike in 2025. I am thinking of spending more time testing the boat in shorter, near-shore missions, before sending it far. Hopefully across the Atlantic this year.

![Brave Puffin 2026 PCB](/img/2026-map1.jpg#medium)

It's calling!