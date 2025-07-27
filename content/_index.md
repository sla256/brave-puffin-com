
**Brave Puffin** is a small autonomous, solar powered, long range boat. It is 1.9 meters long, weighing 35 kg. Brave Puffin is designed to compete in the annual [Microtransat Challenge](https://www.microtransat.org/) in the non sailing, fully autonomous class - that is, to cross the Atlantic Ocean by itself.

## Track Puffin's "Gulf of Maine 2025 Tour" test mission

{{< rawhtml >}}

<div id="map" style="height: 500px;"></div>

{{< setmapsapikey >}}

<script>
  (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({
    key: googleMapsApiKey,
    v: "weekly",
  });
</script>

<script>
    let map;

    async function initMap() {
        const { Map } = await google.maps.importLibrary("maps");
        map = new Map(
            document.getElementById('map'),
            {
                zoom: 10,
                center: {lat: 42.56331230826569, lng: -70.47170181165495},
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                scaleControl: true,
                gestureHandling: 'greedy'
            }
        );

        var routeCoordinates = [
            {lat:42.4904299981991,lng:-70.8491223180837}, // 1 Just off Bocashton
            {lat:42.4875058382777,lng:-70.8490166646259}, // 2 South off Bocashton
            {lat:42.4791178764948,lng:-70.8483246548008}, // 3 West of Roaring Bull
            {lat:42.4709720424515,lng:-70.8338827977422}, // 4 South of Tinker's Island
            {lat:42.4707998518976,lng:-70.671701719999}, // 5 South of Gloucester
            {lat:42.4681078592516,lng:-70.272492472769}, // 6 North of Provincetown
            {lat:43.3275102927984,lng:-69.4393972474251}, // 7 South of Bristol
            {lat:43.7775620973958,lng:-67.3437339189125}, // 8 West of Yarmouth
            {lat:43.0613941947938,lng:-66.60215695585}, // 9 Southwest of Clark's Harbour
            {lat:42.4681078592516,lng:-70.272492472769}, // 6 North of Provincetown
            {lat:42.4707998518976,lng:-70.671701719999}, // 5 South of Gloucester
            {lat:42.4709720424515,lng:-70.8338827977422}, // 4 South of Tinker's Island
            {lat:42.4791178764948,lng:-70.8483246548008}, // 3 West of Roaring Bull
            {lat:42.4875058382777,lng:-70.8490166646259}, // 2 South off Bocashton
            {lat:42.4904299981991,lng:-70.8491223180837}, // 1 Just off Bocashton
            {lat:42.4914809259141,lng:-70.8480092679865}, // 0 Beach
          ];

        var routePath = new google.maps.Polyline({
            path: routeCoordinates,
            geodesic: true,
            strokeColor: '#999999',
            strokeOpacity: 1.0,
            strokeWeight: 2
        });
        routePath.setMap(map);
        // addWaypointMarkers(routeCoordinates, map);

        // var westernStartFinishLineCoordinates = [
        //     {lat:48,lng:-47},
        //     {lat:45.5,lng:-47},
        //     {lat:40,lng:-65},
        //     {lat:30,lng:-77},
        //     {lat:20,lng:-59},
        //     {lat:10,lng:-56},
        // ];

        // var westernStartFinishLinePath = new google.maps.Polyline({
        //     path: westernStartFinishLineCoordinates,
        //     geodesic: true,
        //     strokeColor: '#00aa00',
        //     strokeOpacity: 1.0,
        //     strokeWeight: 1
        // });
        // westernStartFinishLinePath.setMap(map);

        fetch("https://tracking-data.bravepuffin.com/2025-tracking-data.json")
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
                    new Date(parseInt(allPositionsArray[lastPositionIndex].epoch)).toUTCString();

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
                title: allPositionsArray[i].epoch,
                label: { text: (i + 1).toString(), color: 'white', fontSize: "6px" },
                icon: { path: google.maps.SymbolPath.CIRCLE, scale: 4 }
            });
        }
    }

    initMap();
</script>
{{< /rawhtml >}}

![Brave Puffin 2024](img/2024-puffin-pool-shot1_small.jpg)
  
[Puffin 2024](/posts/puffin-2024-announcement) is a younger, bigger brother of Puffin 2020, which was [launched in July of 2020](/posts/2020-july-5th-launch/) and went [MIA 2 months later](/posts/2020-october-25th-mia-update/).

