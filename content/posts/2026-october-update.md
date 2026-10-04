---
title: "Brave Puffin October 2026 update"
date: 2026-10-04
comments: true
---

### Making good progress

After crossing Microtransat's starting line on September 17th, Brave Puffin has covered about 1000 km, as of early October. Roughly 3300 km to go to the finish line.

Hard to predict how long it will take, even if everything continues to go well. Best guess December as the earliest, more likely January.

![Brave Puffin 2026 progress Oct 4](/img/2026-brave-puffin-track-oct-04.jpg#large)

With the days getting shorter and the unstable weather, the boat continues to be underpowered.

On a good day, it can follow the route very closely. Otherwise, the wind and the currents can dominate.

### Warm waters of the Gulf Stream

Receiving the surface water temperature telemetry from Puffin and correlating it to the ocean currents is a lot of fun!

Main surprise (to me): it can be **as warm as 29C / 84F** in the main parts of the Gulf Stream. And we are not talking Miami here - this is 600 km north of Bermuda! Here it is visualized:

![Water temperature and the Gulf Stream currents](/img/2026-brave-puffin-water-temp-2.gif#large)

* **20C / 68F around Boston in early September** (this is pretty warm by our standards)
* Occasionally dropping to **15C / 59F due to tidal currents** (we'll zoom into that shortly)
* 27C / 81F in a major Gulf Stream loop south of Nantucket
* 29C / 84F in the main portion of the Gulf Stream
  * This is also where Puffin set a **record speed of 9 km/h (5.6 mph)**!

You can also see why Puffin did not stick to its route too closely back then; it was better to let it follow the currents.

### Cold, warm, cold again

As I mentioned in the [September update](/posts/2026-september-update), tidal currents in the Gulf of Maine are very strong. Which is why this happened:

![Brave Puffin 2026 water temp tidal](/img/2026-brave-puffin-water-temp-tidal-2.jpg#large)

At that point, Puffin had just cleared Cape Cod, measuring 19C water temp, consistently. Then, very suddenly, it dropped to 15C.

Soon after, the boat is pushed back north by the warm tidal currents from the south. Then another wave of the colder 15C tidal water from the north overtakes it, and so on.

I added a water temperature visualization mode to [Puffin's live tracking page](/track/2026). Note the data there is downsampled quite a bit, so you won't find the same level of detail as in the screenshots above.

### Dealing with propeller fouling problems

I am pretty sure the seaweed and other propeller fouling problems were a big factor in my early mission failures. Learned a lot since then! 

The fouling is very likely to happen, especially in near-shore waters, and especially if the propeller is mounted close to the surface.

![Brave Puffin 2025 seaweed fouled prop](/img/2025-brave-puffin-prop-foul-1.jpg#medium)

First thing I tried was to change the propeller. The 5-inch model shown above is very efficient, but is also very fouling-prone. Adopting a "weedless propeller" from Blue Robotics helped somewhat, but did not solve the problem completely.

Next, I figured someone must have dealt with this before. The best academic papers on this subject I could find are these two: [1](https://www.researchgate.net/publication/355031485_Experimental_Assessment_of_Entanglement_for_a_Propeller_Driven_Unmanned_Underwater_Vehicle) and [2](https://www.sciencedirect.com/science/article/pii/S0029801824017384).

I decided to try two major recommendations from the second paper, which were:

**1) Use a cutting device**

![Propeller with a cutting device](/img/2025-brave-puffin-prop-1.jpg#medium)

Made things marginally better, but did not save the 2025 mission. It also makes propulsion less efficient. DROPPED in 2026.

**2) Periodic reverse**

THAT worked.

I.e. simply changing the direction of the propeller from forward to reverse untangles it, reliably*. There are nuances - when do you reverse? For how long, in what sequence and at what power levels? But by and large it works, both in weed-infested coastal waters and offshore.

*Reliably on two 2026 Brave Puffin models with a careful, clean motor and propeller installation.

### Reactions?

I added a DIY commenting feature to the recent posts. It does not use any third-party software, has no tracking, requires no login, etc. Only some basic anti-spam protection and moderation features.

Feel free to post if you have questions, feedback, etc.
