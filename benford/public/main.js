$(function init() {
    var total = 0;
    var rawData = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    var currentData = [0, 0, 0, 0, 0, 0, 0, 0, 0];

    // Create the graph
    var chart = new Highcharts.Chart({
        chart: {
            type: 'column',
            renderTo: 'container',
        },
        credits: false,
        title: {
            text: 'Twitter experiment'
        },
        xAxis: {
            categories: [
                '1',
                '2',
                '3',
                '4',
                '5',
                '6',
                '7',
                '8',
                '9'
            ]
        },
        yAxis: {
            min: 0,
            title: {
                text: 'Occurrences (%)'
            }
        },
        tooltip: {
            headerFormat: '<span style="font-size:10px">{point.key}</span><table>',
            pointFormat: '<tr><td style="color:{series.color};padding:0">{series.name}: </td>' +
                '<td style="padding:0"><b>{point.y:.1f}%</b></td></tr>',
            footerFormat: '</table>',
            shared: true,
            useHTML: true
        },
        plotOptions: {
            column: {
                pointPadding: 0.2,
                borderWidth: 0
            }
        },
        series: [{
            name: 'Expected',
            data: [30.1, 17.6, 12.5, 9.7, 7.9, 6.7, 5.8, 5.1, 4.6]

        }, {
            name: 'Results',
            data: currentData
        }]
    });

    var socket = io();
    socket.on('all', function(alldata) {
        total = 0;
        for(var digit in alldata) {
            total += alldata[digit]
        }
        
        for(digit in alldata) {
            // Update the table
            $("#occurrences_"+digit).html(alldata[digit])
            $("#percentage_"+digit).html((alldata[digit]/total*100).toFixed(1)+"%")     

            // Update the graph's data
            rawData[digit-1] = parseFloat(alldata[digit]);
            currentData[digit-1] = parseFloat((rawData[digit-1]/total*100).toFixed(1))
        }
        // Re-render the graph
        chart.series[1].setData(currentData);
    });

    socket.on('update', function(data) {

        rawData[data.new_val.id-1] = parseFloat(data.new_val.value);
        $("#occurrences_"+data.new_val.id).html(rawData[data.new_val.id-1]);

        // We need to re-compute the total number of occurrences because we may have missed some
        // changes - like if the connection node-rethinkdb was not available.
        total = 0;
        for(var i=0; i<rawData.length; i++) {
            total += rawData[i];
        }

        // Compute the percentages
        for(var i=0; i<rawData.length; i++) {
            currentData[i] = parseFloat((rawData[i]/total*100).toFixed(1));

            // Update the table
            $("#percentage_"+(i+1)).html(currentData[i]+"%")
        }

        // Update the graph
        chart.series[1].setData(currentData);
    });
});
