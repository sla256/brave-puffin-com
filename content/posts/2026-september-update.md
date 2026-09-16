---
title: "Brave Puffin September 2026 update"
date: 2026-09-15
---

### Busy summer: two Brave Puffin boats, multiple launches, one attempt in progress

So much to share but I know I have to keep this brief. Highlights:

* The [new 2026 rudder-based Puffin](/builds#2026)  performed well in multiple overnight autonomous tests, was launched into the Gulf of Maine, malfunctioned, drifted for ~2 months while being passively tracked, and... keep reading.

* Last year's [2025 thrust steering Puffin](/builds#2025) was promptly refurbished and also launched into the Gulf of Maine. And:

* Did you know that tidal currents in the Gulf of Maine are off the charts crazy, some of the strongest on the planet? I didn't. 

* 2025 Puffin was brought back after 3 weeks in the gulf, inspected, upgraded, and launched onto a proper Microtransat mission, on a different route; [it is in progress](/track/2026)!

* Turns out keeping the satellite communication (Iridium) antenna under the solar panel is NOT a good idea.

* A gimbal-mounted backup SPOT tracker IS a good idea.

### 2026 Puffin

I enjoyed building and [testing this boat](https://www.youtube.com/watch?v=vQCE6nEdyH8). It has a robust and efficient hull with a rudder layout, a wind sensor and a mast for future upgrades; yet it is light and compact.

It has many electronics upgrades on a custom-designed PCB, including an LTE (cell) modem for frequent communication during near-shore test missions and over-the-air firmware upgrades:

![Brave Puffin 2026 PCB fragment](/img/2026-brave-puffin-pcb-1.jpg#medium)

Launched it on July 18th:

![Brave Puffin 2026 pre-launch](/img/2026-brave-puffin-launch-1.jpg#medium)

And promptly lost control the next day. I think it capsized (long story).

Thankfully, I installed a battery-powered backup satellite tracker, gimbal-mounted (i.e. always pointing up), even if the boat is inverted. You can see its dedicated enclosure in the picture above, peeking from under the solar panel.

So, I could still track the boat. It would phone home via Iridium occasionally, but otherwise it was totally drifting, making some strange art over the next 2 months:

![Brave Puffin 2026 drift in GOM](/img/2026-brave-puffin-track-1.jpg#large)

Until a few days ago, when I got a message from someone on a Canadian fishing boat. They found it and brought it on board!

They are still offshore. We agreed to talk in a couple of weeks to facilitate the pickup. Can't wait to read the logs and inspect the boat - yes, it was a failed mission, but I am sure I'll learn a lot from it.


### 2025 Puffin on a 2026 mission

Undeterred, I took the old 2025 boat, refurbished and upgraded it, tested it near shore and launched it within a week. That became a 3-week roundtrip shakedown mission. You can see that initially it was mostly following the route and going straight. Then, about 65 km off the coast of Nova Scotia, things got strange. The boat would not make any progress, despite seemingly favorable conditions:

![Brave Puffin 2025 launch 1](/img/2025-brave-puffin-test-1.jpg#large)

Well, that was me learning the hard way that the tidal currents there are nothing like what we have here in Boston. They can reach and exceed 5 knots (i.e. 9 km/h) or so in some areas, and, naturally, the currents change direction multiple times a day:

![Gulf of Maine tidal currents](/img/gom-currents-forecast.gif#large)

Meanwhile, the maximum speed that the 2025 model can do, fully charged and at max power, is about 4 km/h. I simply could not route the boat through! Plus, the main satellite (Iridium) communication was spotty. I turned the boat around, and successfully retrieved it in late August.

### Transatlantic attempt

Launching in early September is quite late in the year for an underpowered solar boat to go across the ocean on the shortest possible, **northern** route. (My original route was aiming for [Puffin Island](https://en.wikipedia.org/wiki/Puffin_Island_(County_Kerry)).)

Thus, to get more sun and to benefit from the Gulf Stream, Brave Puffin is going to the **Canary Islands:**

![2026 attempt southern route September 15](/img/2026-brave-puffin-southern-route-1.jpg#large)

What you see on this ^ map:

* The long green line is the intended route, featuring major waypoints
* The short red line on the left is Puffin's track so far, between August 29th and September 15th, as of this writing
* It is roughly south of Cape Cod and at the latitude of Washington DC, after completing ~800 km so far
* It entered the Gulf Stream and is about to cross Microtransat's starting (blue) line
* It has a long way to the (yellow) finish line: 5000 km remaining; it will take 3-4 months if all goes well
* This is not the shortest route: my intent was to "punch through" tidal currents, tap into the Gulf Stream, and avoid the Sargasso Sea
* The swirly colored lines show major currents; they are animated on my map; can cover next time

### Enough for now

This is getting quite long already. Hopefully Puffin will keep on going, so I'll have more opportunities to share its progress and the lessons learned.