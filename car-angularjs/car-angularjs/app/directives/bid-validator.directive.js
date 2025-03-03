angular.module('carApp')
.directive('bidValidator', [
    '$timeout', 
    function($timeout) {
    return {
        restrict: 'A',
        require: 'ngModel',
        link: function(scope, element, attrs, ngModel) {
            element.addClass('bid-input');

            // Watch for value changes
            element.on('input', function() {
                $timeout(function() {
                    const bid = parseFloat(element.val());
                    if (!isNaN(bid)) {
                        scope.vm.bid.amount = bid;
                        scope.vm.totalPrice = scope.vm.totalDays * bid;
                    }
                });
            });

            ngModel.$validators.bidAmount = function(modelValue, viewValue) {
                const minPrice = scope.vm.car.price_per_day;
                const bid = parseFloat(modelValue || viewValue);

                const isValid = !isNaN(bid) && 
                              bid >= minPrice && 
                              bid <= minPrice * 10;

                if (isValid) {
                    element.removeClass('invalid');
                    element.addClass('valid');
                } else {
                    element.removeClass('valid');
                    element.addClass('invalid');
                }

                return isValid;
            };
        }
    };
}]);