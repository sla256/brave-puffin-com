---
author: "Slava Asipenko"
title: "Portable thruster efficiency tester and first results"
date: "2024-12-24"
tags: 
- general
- build-2024
---

{{< toc >}}

## Intro
While working on various versions of Brave Puffin in the last 5 years, I ran several dozens of different underwater thruster efficiency tests - to find the best combination of the motor, propeller, ESC, mounting, etc.

The tests were mostly manual - measuring the thrust with a scale, averaging and writing down power consumption in a spreadsheet. Quite time consuming and not that accurate; the **old testing rig** looked like this:

![Testing thruster efficiency manually](/img/manual-efficiency-testing.jpg#medium)

Finally, I decided to build a dedicated testing rig this year. Worked out pretty well - a much faster and more accurate way to test. This post shares some of the build details, but mainly the test results.

Testing rig's main requirements were:
* **Portable and floating** - so it can be used both in a container and open water conditions e.g. on a lake
* **Fully automated** - "just push the button" - the rig should automatically go through all test modes, measuring and recording thrust and power levels
* **Support 1 - 100W power range** with reasonable accuracy

## Build

* ESP32 based controller on a custom PCB board with sensors, SD card writer, etc.
* 20 kg load cell mounted on a rigid aluminum bracket and 1/8" steel angle; calibrated in place.
* 3S 7P lithium-ion battery pack - can deliver couple hundreds watt of power.
* Foam based platform, 12"x1.5"x3/8" motor mounting arm, swinging on pressed bearings to reduce friction.
* [Embedded software](https://github.com/sla256/brave-puffin-thruster-efficiency-tester) to perform calibration,
run the test, measure and record data; Bluetooh controlled.

![Testing rig pictures](/img/testing-rig-pics.jpg)

## Test results

### Basic test

So let's mount a particular motor + propeller combo to be tested, and run the thing. It automatically increments the power to the motor over the course of several minutes, while measuring and recording the results on the SD card. Now we want to analyze the data - what are we looking at here?

![Basic test chart](/img/2024-basic-test-chart.jpg)

First, the **red scatter chart - it shows how thruster's force changes depending on the power** that the motor consumes. Naturally, the more power, the more force: at 10 watt we observe ~0.8 kg of thrust, and at rig's max of ~120W we see almost 4kg. The amount of power on a solar boat is always limited, so it's very important to use it in the best possible way.

For that we need to look at the **efficiency, the blue chart** - how much thrust are we getting for a unit of power? As you can see, there is a very distinct peak efficiency for this motor + prop combo. Right around 8-9W it reaches ~80 gram/watt factor - the max.

The thrust at this point is not very big, only 0.7kg, but it's the most efficient regime - a cruise mode.  It could be good for long nights or cloudy days when the boat needs to conserve power yet keep moving. Note that Brave Puffin uses two motors & thrust steering, so the total force in cruise mode would be 2x that - at the cost of the increased drag.

After the peak, the efficiency declines quickly - the faster the motor turns, the bigger are various [side effects such as cavitation and turbulence](https://www.thecontactpatch.com/book/marine/m1410-marine-propellers).

Let's look at various factors that could affect the efficiency.

### Push vs. pull

For a long time, I favored pull configuration in most of my builds, because I believed it to be a more efficient configuration. My (old) test data seemingly gave me up to a 10% efficiency advantage of a pull prop. And, I believed it because of a "clean water" argument.

![Pull configuration in 2024 build](/img/2024-motors-cropped.jpg#small)

However, props in pull configuration are more prone to fouling or damage from weeds, lines, trash, etc. And, the question of propeller efficiency in [various installations](https://www.thecontactpatch.com/book/marine/m1405-propeller-installations) is pretty complex.  So I decided to double-check with my new testing rig, using APC's 9" 2-blade prop:

![Pull vs. push efficiency](/img/2024-pull-vs-push-test-chart.jpg)

And... indeed, there is a **~10% efficiency advantage in a pull configuration - but only in a relatively narrow, initial power band** of less than 20W. The difference goes away quickly as the power and thrust increase.

However... This was a container (tub) based test, not open water, with quite a bit of turbulence at higher power / RPM levels:

![9" APC prop during high power phase of the test](/img/9inch-prop-turbulence-clip-15fps.gif)

 The efficiency gap might have disappeared because of that turbulence, which may not be as large of a factor in open water conditions. To be continued... but I am already leaning towards the push configuration going forward.

### ESC 1 (30A) vs. ESC 2 (40A)

Testing a couple of generic ESC's, both work well with a high pole construction of the underwater motor.

![30A and 40A ESC's](/img/30a_and_40a_esc.jpg#medium)

**TL;DR - no efficiency difference**:

![30A vs 40A ESC test chart](/img/2024-30A-vs-40A-test-chart.jpg)

Note clumps of data points for 40A ESC. For some reason, its translation of smooth PWM increments into more power / RPM was very chunky.

### 20A ESC cold vs. warm

For this test, I took the smallest ESC I had, rated at 20A and used it in several limited power runs, starting at different temperatures. The idea is to see whether there will be any efficiency difference.

![20A ESC](/img/20A-esc.jpg#medium)

In "cold start" runs, the ESC would start at room temperature of ~20C, and end up at ~40C when the test finishes. Before the "warm start" run, I'd load the ESC up at high power (~11A / ~120W) for a while, so it would warm up to ~60C, immediately followed by a "warm start" test:

![20A cold vs warm test chart](/img/2024-20A-cold-vs-warm-test-chart.jpg)

I can't see any difference, though I thought there would be some... I remember observing lower efficiencies on hot ESC's in my old manual tests, but perhaps the MOSFETS need to be much warmer (80C? 100C?) for this effect to be noticeable.

### 10" vs. 9" vs. 5" vs. 3" propeller

Let's compare efficiency of different propellers: 10" 2-blade APC marine (not shown), 9" 2-blade APC marine, 5" 3-blade generic drone prop and 3" 2-blade T200 prop.

![9" vs. 5" vs. 3" propeller comparison](/img/9in-5in-3in-prop-comparison.jpg)

The showdown:

![3" vs. 5" vs. 9" vs. 10" propeller test chart](/img/2024-3in-5in-9in-10in-test-chart.jpg)

Several things jump out:
* 3" propeller is obviously in a different category. It's designed for another use case such as maneuvering a small underwater ROV with a bunch of thrusters & shrouds. Not efficient as a main propulsion unit for a bigger ASV.
* I was surprised how relatively well the 5" air drone propeller performed; this was the same prop that I used on 2020 Brave Puffin.
* The **9" APC prop is a winner so far - it's ~10% more efficient** in almost all regimes

Several caveats for the 10" propeller results:
* This particular prop had a more aggressive pitch of 8 inches, vs. 5 for the 9" prop
* It's overall design was much less "swept" than 9" one's
* I did not run the full 10" test - see the green chart ending half way - as it was already clear it was underperforming compared to 9"

I have other versions of 9" and 10" props from APC, and can test them later. But I am not planning to go bigger than 10" for practical reasons. It would be also interesting to test a ducted version, a "true" boat optimized, 3 blade propeller, 24V motors and so on.

## Questions or comments?

Please!

