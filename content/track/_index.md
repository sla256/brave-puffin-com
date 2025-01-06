---
title: Track
description: Track Brave Puffin's 2020 Microtransat mission progress
comments: false
---

### 2020 mission's route and progress

##### Last known coordinates

##### Distance from launch point

{{< rawhtml >}}
<div id="map" style="height: 500px;"></div>
<script>
    function initMap() {
        var map = new google.maps.Map(
            document.getElementById('map'),
            {
                zoom: 5,
                center: {lat: 41, lng: -44},
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                scaleControl: true,
                gestureHandling: 'greedy'
            }
        );

        var routeCoordinates = [
            {lat:41.889272,lng:-69.943068}, // start: marconi beach
            {lat:42.69553,lng:-65.47453}, // south of nova scotia outbound
            {lat:43.418218,lng:-59.870919}, // south of sable island outbound
            {lat:46.11451,lng:-52.84976}, // south of labrador outbound
            {lat:51,lng:-16}, // east line target center point
            {lat:45,lng:-30}, // north of azores
            {lat:44,lng:-53}, // south of labrador inbound
            {lat:43.353556,lng:-59.870704}, // south of sable island inbound
            {lat:42.602859,lng:-65.473474}, // south of nova scotian inbound
            {lat:41.872847,lng:-69.912847}, // marconi beach approach
            {lat:41.869916,lng:-69.949104}, // marconi beach finish
        ];

        var routePath = new google.maps.Polyline({
            path: routeCoordinates,
            geodesic: true,
            strokeColor: '#999999',
            strokeOpacity: 1.0,
            strokeWeight: 2
        });
        routePath.setMap(map);
        addWaypointMarkers(routeCoordinates, map);

        var westernStartFinishLineCoordinates = [
            {lat:48,lng:-47},
            {lat:45.5,lng:-47},
            {lat:40,lng:-65},
            {lat:30,lng:-77},
            {lat:20,lng:-59},
            {lat:10,lng:-56},
        ];

        var westernStartFinishLinePath = new google.maps.Polyline({
            path: westernStartFinishLineCoordinates,
            geodesic: true,
            strokeColor: '#00aa00',
            strokeOpacity: 1.0,
            strokeWeight: 1
        });
        westernStartFinishLinePath.setMap(map);

        fetch("https://tracking-data.bravepuffin.com/all-tracking-data.json")
            .then(response => response.json())
            .then((allPositionsArray) => {
                var testingPath = new google.maps.Polyline({
                    path: allPositionsArray,
                    geodesic: true,
                    strokeColor: '#FF0000',
                    strokeOpacity: 1.0,
                    strokeWeight: 3
                });
                testingPath.setMap(map);

                addSampledMarkers(allPositionsArray, map);

                var lastPositionIndex = allPositionsArray.length - 1;
                document.getElementById("last-known-coordinates").innerHTML = 
                    allPositionsArray[lastPositionIndex].lat.toFixed(3) + "," + 
                    allPositionsArray[lastPositionIndex].lng.toFixed(3) + " on " +
                    allPositionsArray[lastPositionIndex].datetime;

                map.panTo(allPositionsArray[lastPositionIndex]);

                var launchPoint = new google.maps.LatLng(routeCoordinates[0].lat,
                    routeCoordinates[0].lng);
                var currentCoord = new google.maps.LatLng(allPositionsArray[lastPositionIndex].lat,
                    allPositionsArray[lastPositionIndex].lng);

                var distanceFromLaunch = google.maps.geometry.spherical.computeDistanceBetween(
                    launchPoint, currentCoord);
                document.getElementById("distance-from-launch-point").innerHTML = 
                    Math.round(distanceFromLaunch / 1000) + " km from launch point";
                
            })
            .catch(err => { throw err });
    }

    function addWaypointMarkers(waypointPositionsArray, map) {
        for(let i = 0; i < waypointPositionsArray.length; i++) {
            new google.maps.Marker({
                position: waypointPositionsArray[i],
                map: map,
                icon: { url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png" }
            });
        }
    }

    function addSampledMarkers(allPositionsArray, map) {
        const stepIncrement = Math.round(allPositionsArray.length / 10) + 1;
        for(let i = 0; i < allPositionsArray.length; i += stepIncrement) {
            new google.maps.Marker({
                position: allPositionsArray[i],
                map: map,
                title: allPositionsArray[i].datetime,
                label: { text: (i + 1).toString(), color: 'white', fontSize: "6px" },
                icon: { path: google.maps.SymbolPath.CIRCLE, scale: 3 }
            });
        }
    }
</script>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=AIzaSyAhc_oznfiQu5NLG8kjil8Ig3nRY_mE6AM&callback=initMap&loading=async" type="text/javascript"></script>

{{< /rawhtml >}}
