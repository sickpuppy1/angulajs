angular.module('carApp')
.filter(
    'range', 
    function() {
    return function(input, total) {
        total = parseInt(total);
        input = new Array(total);
        
        for (var i = 0; i < total; i++) {
            input[i] = i + 1;
        }
        
        return input;
    };
});