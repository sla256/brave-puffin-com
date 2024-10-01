---
title: "2020 build: Specs"
date: 2020-07-11
tags:
- build-2020
---

Dry, bullet style list of Brave Puffin's main features and components

<!--more-->

## Hull
* Canoe shaped, 1.8 meter foam filled hull with carbon fiber as outer layer
* Inner and outer aluminum frame
* ~22 kg full dry weight including steel ballast

## Power
* 100 W flexible Sunpower solar panel
* 388 Wh Li-Ion battery pack (Samsung 30Q 18650 cells in 12p3s configuration, 12V nominal)
* MPPT charging controller, balancing board
* Dynamic adjustment of drawn vs. charging energy for optimal efficiency

## Propulsion & steering
* Two Blue Robotics M200 brushless motors for differential steering (no rudder)
* Plastic 6 inch, 3 blade drone propellers
* Two 30A ESC's
* PID controller (in software) & virtual waypoints

## Navigation & routing
* CMPS14 tilt compensated compass
* NEO-6M GPS
* Precomputed map of magnetic variance (declination) covering the North Atlantic
* Hardcoded waypoints for a 5000 km Cape Cod - Ireland - Cape Cod roundtrip route
* 25 meter accuracy target for a waypoint hit

## Sensors & communication
* Pressure, temperature, humidity (onboard)
* Electric current, battery voltage
* Light level
* Globalstar Smartone C satellite tracker
* Bluetooth and WiFi for testing (disabled during the mission)
* RC controller for manual steering overwrite during testing (removed before the mission)

## Electronics

![Puffin main board labeled](/img/2020-puffin-board-labeled.jpg#medium)

1. ESP32 as the main microcontroller (80 Mhz, 529 KB SRAM, 4 MB Flash)
2. CMPS14 - [tilt compensated compass](/posts/steering)
3. Globalstar Smartone C - hardwired for power and data inputs, out of the enclosure to save space
4. NEO-6M - GPS unit for navigation
5. GPS antenna
6. 10A MPPT solar panel controller
7. 5V - 3.3V voltage level converters
8. BME280 - onboard temperature, humidity and pressure sensor
9. Serial logger with micro SD card
10. ATmega328P programmed to reset ESP32 every 8 hours
11. Magnetic reed switch for external launch sequence

Not shown, on the opposite side of the main board:

* Two 30A Raptor ESC controllers
* Two INA219 current and voltage sensors
* 5A DC-DC step down switching regulator, set to supply 5V off the main 12V battery pack

## Safety
* Independently powered and controlled safety light
* Custom built from multiple power LED's for long distance visibility
* Separate enclosure with ESP32-CAM as a controller
* Programmed to blink the light at night


