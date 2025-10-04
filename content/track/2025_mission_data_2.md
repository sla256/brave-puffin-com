---
title: 2025 mission #2 data
date: 2025-10-04
comments: false
---

{{< rawhtml >}}

<table id="mission-data">
<tr id="header-row">
    <th>i</th>
    <th>Time</th>
    <th>Vb</th>
    <th>Ib</th>
    <th>Is</th>
    <th>Te</th>
    <th>Hu</th>
    <th>PWMc</th>
    <th>Il</th>
    <th>Ir</th>
    <th>PWMl</th>
    <th>PWMr</th>
    <th>Rn</th>
    <th>Rt</th>
    <th>Sr</th>
    <th>Er</th>
    <th>Es</th>
    <th>Wp</th>
    <th>Dn</th>
    <th>B</th>
    <th>M</th>
    <th>He</th>
    <th>Pi</th>
    <th>Ro</th>
</tr>
</table>

<script>
fetch("https://tracking-data.bravepuffin.com/2025-tracking-data-2.json")
    .then(response => response.json())
    .then((allDataPointsArray) => {
        const table = document.getElementById("mission-data");
        for (let i = allDataPointsArray.length - 1; i >= 0; i--) {
            const dataPoint = allDataPointsArray[i];
            const row = document.createElement("tr");
            row.innerHTML = `
            <td>${i}</td>
            <td>${new Date(dataPoint.epoch * 1000).toLocaleString()}</td>
            <td>${dataPoint.batteryVoltage}</td>
            <td>${dataPoint.batteryCurrent}</td>
            <td>${dataPoint.solarCurrentAmps}</td>
            <td>${dataPoint.onboardTemperatureC}</td>
            <td>${dataPoint.onboardHumidity}</td>
            <td>${dataPoint.cruisePulseWidthTens}</td>
            <td>${dataPoint.motorLeftCurrentDrawAmps}</td>
            <td>${dataPoint.motorRightCurrentDrawAmps}</td>
            <td>${dataPoint.pwmL}</td>
            <td>${dataPoint.pwmR}</td>
            <td>${dataPoint.runNumber}</td>
            <td>${dataPoint.runtimeHours}</td>
            <td>${dataPoint.satMessagesReceived}</td>
            <td>${dataPoint.receivedEnergy}</td>
            <td>${dataPoint.spentEnergy}</td>
            <td>${dataPoint.waypointIndex}</td>
            <td>${dataPoint.distanceToNexWaypointKm}</td>
            <td>${dataPoint.bearing}</td>
            <td>${dataPoint.compassMagneticHeading}</td>
            <td>${dataPoint.compassTrueHeading}</td>
            <td>${dataPoint.pitch}</td>
            <td>${dataPoint.roll}</td>
            `;
            table.appendChild(row);
        };
    })
    .catch(err => { throw err });
</script>
{{< /rawhtml >}}
