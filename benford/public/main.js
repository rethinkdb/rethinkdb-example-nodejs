$(function() {
    var socket = io();
    var total = 0;

    socket.on('all', function(alldata) {
        for(var digit in alldata) {
            total += alldata[digit]
        }
        for(digit in alldata) {
            $("#occurrences_"+digit).html(alldata[digit])
            $("#percentage_"+digit).html((alldata[digit]/total*100).toFixed(1)+"%")
        }
    });
    socket.on('update', function(data) {
        $("#occurrences_"+data.new_val.id).html(data.new_val.value)
        total += data.new_val.value-data.old_val.value
        $("#percentage_"+data.new_val.id).html((data.new_val.value/total*100).toFixed(1)+"%")
    });
});
