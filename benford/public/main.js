$(function() {
    var socket = io();

    socket.on('all', function(alldata) {
        for(var i=0; i<alldata.length; i++) {
            $("#"+alldata[i].id).html(alldata[i].value)
        }
    });
    socket.on('update', function(data) {
        $("#"+data.new_val.id).html(data.new_val.value)
    });
});
