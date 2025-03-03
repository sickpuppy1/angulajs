angular.module('carApp')
.directive('nameValidator', function() {
    return {
        require: 'ngModel',
        link: function(scope, element, attrs, ctrl) {
            ctrl.$validators.nameValidator = function(value) {
                if (!value) return false;
                return /^[a-zA-Z\s]{2,50}$/.test(value);
            };
        }
    };
})
.directive('emailValidator', function() {
    return {
        require: 'ngModel',
        link: function(scope, element, attrs, ctrl) {
            ctrl.$validators.emailValidator = function(value) {
                if (!value) return false;
                return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
            };
        }
    };
})
.directive('passwordValidator', function() {
    return {
        require: 'ngModel',
        link: function(scope, element, attrs, ctrl) {
            ctrl.$validators.passwordValidator = function(value) {
                if (!value) return false;
                const hasMinLength = value.length >= 8;
                const hasUpperCase = /[A-Z]/.test(value);
                const hasLowerCase = /[a-z]/.test(value);
                const hasNumbers = /\d/.test(value);
                return hasMinLength && hasUpperCase && hasLowerCase && hasNumbers;
            };
        }
    };
})
.directive('mobileValidator', function() {
    return {
        require: 'ngModel',
        link: function(scope, element, attrs, ctrl) {
            ctrl.$validators.mobileValidator = function(value) {
                if (!value) return false;
                return /^[0-9]{10}$/.test(value);
            };
        }
    };
});