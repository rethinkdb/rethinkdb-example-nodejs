$(function init() {
    var total = 0; // total number of occurrences
    var occurrences = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // occurrences of each digit (shifted by 1)
    var percentages = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // percentages of each digit (shifted by 1)

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
            data: percentages
        }]
    });

    // Initialize socket.io
    var socket = io();

    socket.on('all', function(alldata) {
        // We are sent the occurrences of every digit

        total = 0;
        for(var digit in alldata) {
            total += alldata[digit]
        }
        
        for(digit in alldata) {
            // Update the table
            $("#occurrences_"+digit).html(alldata[digit])
            $("#percentage_"+digit).html((alldata[digit]/total*100).toFixed(1)+"%")     

            // Update the graph's data
            occurrences[digit-1] = parseFloat(alldata[digit]);
            percentages[digit-1] = parseFloat((occurrences[digit-1]/total*100).toFixed(1))
        }

        // Re-render the graph
        chart.series[1].setData(percentages);
    });

    socket.on('update', function(data) {
        // We have an update for one digit

        // Update the number of occurrence
        occurrences[data.new_val.id-1] = parseFloat(data.new_val.value);
        $("#occurrences_"+data.new_val.id).html(occurrences[data.new_val.id-1]);

        // We need to re-compute the total number of occurrences because we may have missed some
        // changes - like if the connection node-rethinkdb was not dropped.
        total = 0;
        for(var i=0; i<occurrences.length; i++) {
            total += occurrences[i];
        }

        // Compute the percentages of every digit
        for(var i=0; i<occurrences.length; i++) {
            percentages[i] = parseFloat((occurrences[i]/total*100).toFixed(1));

            // Update the table
            $("#percentage_"+(i+1)).html(percentages[i]+"%")
        }

        // Update the graph
        chart.series[1].setData(percentages);
    });
});
