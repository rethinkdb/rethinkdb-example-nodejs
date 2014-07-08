$(function() {
    var socket = io();
    var total = 0;
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

    socket.on('all', function(alldata) {
        for(var digit in alldata) {
            total += alldata[digit]
        }
        
        for(digit in alldata) {
            // Update the table
            $("#occurrences_"+digit).html(alldata[digit])
            $("#percentage_"+digit).html((alldata[digit]/total*100).toFixed(1)+"%")     

            // Update the graph's data
            currentData[digit-1] = parseFloat((alldata[digit]/total*100).toFixed(1))
        }
        // Re-render the graph
        chart.series[1].setData(currentData);
    });

    socket.on('update', function(data) {
        // Update the table
        $("#occurrences_"+data.new_val.id).html(data.new_val.value)
        total += data.new_val.value-data.old_val.value
        $("#percentage_"+data.new_val.id).html((data.new_val.value/total*100).toFixed(1)+"%")

        // Update the graph
        currentData[data.new_val.id-1] = parseFloat((data.new_val.value/total*100).toFixed(1));
        chart.series[1].setData(currentData);
    });
});
