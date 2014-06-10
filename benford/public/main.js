$(function() {
    var socket = io();

    socket.on('all', function(alldata) {
        for(var digit in alldata) {
            $("#"+digit).html(alldata[digit])
        }
    });
    socket.on('update', function(data) {
        $("#"+data.id).html(data.value)
    });
});
