---
title: "2020 build: Brave Puffin's Propulsion - motors and propellers"
date: 2020-07-24
tags:
- build-2020
---

<!--more-->

OK, where do I start... 

I was set on using differential steering with two motors and no rudder from the early "local pond" prototype:

![Puffin Mark I](/img/puffin-mk-i.jpg#medium)

My thinking was: you need an efficient and reliable motor anyway. Otherwise, you are dead in the water. Once you have a good, proven motor, might as well use two, and avoid relying on a servo based rudder. Which otherwise will need to be tuned, water proofed, tested, etc.

Additionally, my hunch was that differential steering will be more precise than rudder based, and be able to better deal with the winds and currents.* That assumption was more or less correct - Puffin can deal with moderate winds and waves easily, hitting 25 meter radius for waypoints consistently. This is an actual route from a 6 km test run, reconstructed from the telemetry records minute by minute, showing the boat nailing the course between 3 waypoints:

![6 km test run](/img/puffin-6km-nahant-baytest-run-2020-06-28.jpg#medium)

It's a protected bay though, so I don't really know how it would do in strong winds or a storm, but for the first few days of 2020 mission the boat was staying on course really well.

At any rate, I was comitted to having two motors, and that made me double down on finding a good and efficient device early on. There are excellent commercial underwater versions, but they are somewhat pricey, and the mid range ones are not optimized for efficiency.

The efficiency is everything for a small solar powered boat - Puffin has a solar panel nominally rated for 100W, but really what it gets on average is more like 50W - and that is not much. A 10% efficiency loss means weeks of extra travel time, when something else can go wrong.

## 2019

For many months I iterated on finding and testing an affordable, efficient brushless motor that I could also customize for durability. I built a simple sliding carriage rig for efficiency testing:

![Motor testing rif](/img/motor-test-rig.jpg#medium)

I used it to test dozens of combinations of motors, ESC's, props, bearings, mounting configurations, etc. In this collage (a subset of what I tried) you can see small water propellers commonly used in RC toy boats, lots of air drone props, a silly custom made one and a few Blue Robotics props. The motors are all of brushless type**, ranging from average air drone products to cheap claimed-to-be-underwater-rated ones.

![Propulsion components](/img/propulsion-components-collage.jpg#medium)

 The testing was to simply measure the pull force vs. consumed power in various ESC settings. Most promising combinations got recorded in a spreadsheet, I used a gram-of-the-pull-force / watt-of-consumed-power metric:

![Motor efficiency testing](/img/motor-efficiency-testing-spreadsheet.jpg#medium)

My findings were:

* High torque, slow "RPM" (Kv rating) motors are most efficient
  * Not surprising - at high RPM propellers will cavitate
  * However most drone motors are high RPM, meaning they won't have enough torque for water application at low RPM
  * High torque ones tend to be bulky or very expensive
* Thin, big, 3 blade air drone props are most efficient
  * In theory 2 blade (or even one blade) props would be more efficient, but I could not find one during testing. 2 blade props I have were either not thin enough or too big.
* Custom made propeller shrouds are not good enough to increase efficiency
* In 2019, I settled on 5010 360kv motor - cheap, efficient, reliable (after modding) - though not that small

This is what the motor and propeller looked like after spending a few weeks in the water during 2019 test mission. Sand grains make it look worse than it was.

![5010 motor after test mission](/img/5010-motor-after-2019-test-mission.jpg#medium)

After finding an efficient motor came the durability challenge... The motors need to operate non stop, under load, fully immersed in salt water, for at least 3 months. There are several issues, all a result of a highly corrosive salt water environment:

1. Left unprotected, the coils (windings) will likely corrode
2. The bearings will absolutely corrode, or just disintegrate
3. Other parts can also corrode: magnets, rotor case, etc.

This is one of those cheap motors that are supposedly designed for underwater use, before and after running in salt water for a few days:

![Brushless motors rusted](/img/brushless-motors-rusted.jpg#small)

It actually kind of still worked, but it was very inefficient.

Additionally, some motor components such as stainless steel bearings can do fine in salt water, unless you get them in and out of water repeatedly during testing. If you don't rinse them very thoroughly with fresh water, they will corrode - so it is hard to avoid in practice.

The first problem is relatively easy to deal with: saturate the windings with a marine grade epoxy or a potting compound:

![5010 motor epoxy modding](/img/5010-motor-epoxy-modding.jpg#medium)

The second problem (bearings) is harder. There is stainless steel (304)... and there is marine grade stainless steel (316). You want the latter - but I could not find such ball bearings of needed size, in time. The regular stainless steel (304) will corrode, sooner or later. I tried all sorts of other materials in bearings, including hybrid ceramics (nope), full ceramic (won't corrode but can't take the beating) - and in 2019 the solution was simply to stick with 5010 motor's original, fresh, 304 stainless steel ball bearings. I tested a modified motor in a bucket of salt water for 30 days - it was still running. The shaft started wobbling just a bit so the efficiency must have suffered, but it was OK.

Commercial solutions I am aware of seem to be using plastic bearings, which I think are not even ball bearings - just low friction plastic insert, manufectered to high precision. Not sure though.

The third challenge (other motor parts corroding) - was not too bad either. I painted the magnets in the rotor, and made sure to avoid regular steel based parts.

In retrospect, I spent a lot of money and time on those customizations and iterations. I enjoyed it and learned a lot (including reading thick, above my head papers on propeller efficiency and material properties), but it was not an efficient use of my resources.***

## 2020

In 2020, I simply bought two Blue Robotics T200 thrusters. On paper, they were almost as efficient as my 2019 custom modified thrusters. And I was looking forward to the protection of the commercially made shrouds.

These thrusters are a high quality product. However, the efficiency was noticeably lower than what I was aiming for, about 30% less than what I knew I could do. So... I ripped out M200 motors out of T200 thrusters, and mounted them bare, with 6" plastic drone props:

![2020 motors front view](/img/puffin-2020-motors-front-view.jpg#medium)

Measured the efficiency - back to my target! - and that was it.

...

Actually, no. As of this writing, 3 weeks into 2020 launch, I am pretty sure the right motor has failed. I don't know why, yet. It could be entagled in a piece of string. Or the prop could be off. Or it could be a defect. These motors are rated for months of continuous use, but the right motor started to feel and sound different after several weeks of testing... I beat myself up for not paying closer attention to this before the launch.

Next up to cover would probably be the steering and navigation!

---

\* There are downsides of having 2 motors too, of course. More drag and additional power required for active steering, to name a few.

\** Yes, brushless motors work under water just fine, even without much modification, especially in fresh water. Heck, even brushed motors work under water! But only for ~30 minutes - I tried. The water turns muddy green, fast. And you get this back:

![Brushed motors rusted](/img/brushed-motors-rusted.jpg#medium)

Brushed motors are quite efficient actually, but they have 2 major flaws: the brushes wear out rather quickly when in continuous use (months!), and they need to be 100% protected from the water. This requires a good enclosure and very good sealing for the shaft. That can be done, but "very good sealing" will then usually mean extra friction, so you will lose the efficiency.

\*** [The SeaCharger project](http://www.seacharger.com/build-blog/thruster) dealt with all those propulsion problems differently, and more effectively I have to say.