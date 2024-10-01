---
title: "2020 build: Brave Puffin's navigation"
date: 2020-10-24
tags:
- build-2020
---

<!--more-->

## Magnetic variation

My last build post on [steering](/posts/steering) covered some of the magnetic compass errors in detail. However, I intentionally skipped one factor: [magnetic variation](https://en.wikipedia.org/wiki/Magnetic_declination). It is environmental and global in nature, so I consider dealing with it closer to the problem of navigation rather than construction.

In short, [magnetic north pole](https://en.wikipedia.org/wiki/North_Magnetic_Pole) is not in the same place as geographic North pole. Therefore, the readings of any magnetic compass need to be compensated if you want to use them for true geographic navigation. The error can be quite large: 14 degrees in Boston, 20 in some parts of North Atlantic, and even larger farther up north. Given the accuracy of GPS, you actually might be able to ignore this error and still arrive at the waypoints, at the cost of sub-optimal routing and meandering.

However, I decided to try dealing with magnetic variation to achieve the most precise navigation possible. Trouble is, the source of the magnetic variation is not just misalignment of the poles. Local deposits of iron ore and irregularities of Earth's deep flows also affect the magnetic fields on the surface, so there is no nice and simple model to calculate the error, globally. 

![World magnetic declination](/img/world-magnetic-declination.jpg#medium)

NOAA publishes [The World Magnetic Model](https://www.ngdc.noaa.gov/geomag/WMM/)* - the last time I checked, it was a 700K worth of C code... Not feasible to use on a small microcontroller. I decided to instead precompute and hardcode a table of magnetic variation errors, covering all of North Atlantic, one value per 10° latitude x 1° longitude tile.

This approach worked out well: it is fast, and requires only 0.5K of storage for data. I made sure to write unit tests to check that edge cases are taken care of and there won't be a silly conversion bug in the middle of the ocean. My averaged magvar values per tile were within 1, at most 2 degrees of the actual variations in corresponding locations.

![Magvar code snippet](/img/magvar-code-snippet.jpg#medium)

I want to give kudos to https://github.com/jafrado/magdec project which publishes raw magvar data - it made it much easier for me!

## Routing

Geo navigation is a pretty well understood problem, and is relatively easy to deal with using open source software libraries. Puffin's 2020 roundtrip route consists of only 11 hardcoded waypoints. The boat is programmed to hit its waypoints no matter what, i.e. it will not skip the next waypoint even if it's farther ahead in the desired route. (but read on...)

I created a simple spreadsheet to keep track of the testing and final routes, with formulas to calculate distances and approximate travel time.

![Route spreadsheet](/img/route-spreadsheet.jpg#medium)

 The spreadsheet also emits C code to make sure there is no mistake in transfering the route to the main program. Next waypoint's index is stored in EEPROM to make sure it is preserved between restarts.
 
 Huge shoutout to [SlashDevin](https://github.com/SlashDevin) for the excellent [GPS parser and nav library NeoGPS](https://github.com/SlashDevin/NeoGPS) - it was a breeze to use.

Since the boat at any given time knows its current positon vs. the next waypoint, it can just calculate the direction to get there by using `BearingTo` function from NeoGPS. The result is boat's desired heading, it is then fed into [steering](/posts/steering) and [propulsion](/posts/propulsion) subsystems as input.

## Simulator

When preparing for 2020 attempt, I implemented a simple onboard simulator. The idea was to make sure routing and navigation code can handle the entire trip, and the actual hardcoded route does not have typos. It was also a way to test that all software and hardware components will work together as expected over the long run.

I took a fairly simple approach: when in simulation mode**, the boat ignores actual GPS and compass signals and instead simulates its position off the preprogrammed route, with random noise added. The simulation can run at various speeds, for example at 20x it could complete its 2020 roundtrip route in a week or so. The simulator did not introduce things like wind or current effects.

![Final simulated route](/img/simulated-route.jpg)

I found a few minor bugs through simulator testing. I also learned there are islands in North Atlantic!

![Sable Island](/img/sable-island.jpg#small)

My original route was putting the boat way too close to Sable Island. I did not see it while choosing waypoints at large scale, but inspecting the simulated course made it quite visible.

## Virtual waypoints

The last interesting problem related to navigation comes courtesy of the effects of strong winds and currents in the open ocean. No matter how precise the steering is, a strong crosswind will push the boat off course even if its bow is pointing perfectly to the next waypoint.

Because waypoints are really far off (e.g. hundreds of kilometers), boat's desired heading would not change significantly even if its off course by many kilometers. It is related to a well known issue during airplane landing in crosswinds, when precise course keeping is paramount.

Traditional, effective solution is a crabbing technique, i.e. intentional, partial steering into the wind:

![Airplane crabbing](/img/airplane-crabbing.jpg#medium)

Unfortunately, calculating correct amount of crabbing correction requires knowing accurate wind direction and strength. Good wind sensors are expensive! Plus it will be one more piece of hardware to mount, wire and test. Instead, Brave Puffin relies on *virtual waypoints* to deal with the crosswind.

This is how it works. The boat always keeps track of the next actual waypoint - which is the ultimate goal, but usually it will be far away. If so, Puffin will calculate its next temporary (virtual) target as a much closer point 400 meters*** away, directly on the most optimal course. So the actual path might look something like this:

![Virtual waypoints](/img/virtual-waypoints.jpg#medium)

Of course even with this approach, drifting off course will still happen in strong cross winds.

First, if the boat cannot hit its next virtual waypoint in a reasonable but relatively short amount of time, it will abandon it, and calculate another one. Unlike actual waypoints, it will not try to hit virtual ones at all cost. This is to prevent the boat from getting stuck during really unfavorable conditions.

Second, Puffin's criteria for hitting a waypoint (real or virtual) is to get to its 25 meter radius. Thus, drifting errors can still accumulate over the long distance - but hopefully at a slower rate than without any compensation.

## Is it "autonoumous"?

As of 2020, consumer expectations for autonomous vehicles are very high - and they should be.

Given that Puffin's route is fixed, and the boat is programmed to not skip actual waypoints - I can't quite call Brave Puffin truly autonomous. Yes, it does not take course corrections from outside, and nobody else is driving. But there is no obstacle avoidace of any sort.

I am not talking about sensor based collision avoidance necessarily - this is impractical on small boats, in my opinion. Rather, I am thinking about spatial obstacle avoidance. It should be possible to program the boat with navigational maps (likely low resolution & encoded), so that it will attempt go around islands, restricted areas, currents, etc. - while following a loose direction towards the end goal.

I briefly considered implementing this in 2020 build, but just ran out of time. It would be fun to try it in the future. I expect that testing obstacle avoidance would be very non-trival, and will certainly require implementing a more robust simulator.

On to 2021!

---

\* Famously, the magnetic poles are drifting at a non negligible speed, so the magnetic model needs to be updated every few years. Not sure if ignoring this can lead to big errors, but I bet commercial solutions are staying up to date. Obviously not a problem if your vehicle is not going to travel autonomously for more than a few months.

\** Besides simulator, Puffin's software test build had a number of other testing modes: directional auto pilot, round trip, RC, fixed power, etc. The boat could be fully controlled via Bluetooth or DSM (RF), and uploaded extensive telemetry via WiFi to the cloud. The final mission build had all of the test modes and unnecessary code removed - out of concern of the unintentional "test" behavior during the mission. That in turn presented an interesting challenge: the final few weeks of preparation required the use of the final "production" build. Which means Puffin could not be course corrected from the chase boat, or even easily stopped.

\*** Why 400 meters? Trial and error. Sufficiently large distance to not make the boat go against the wind too often. Yet sufficiently small to have a meaningful "crabbing on average" effect.