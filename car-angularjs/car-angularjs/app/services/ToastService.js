angular.module('carApp')
.service('ToastService', [function() {
    const defaultOptions = {
        duration: 3000,
        close: true,
        gravity: 'top',
        position: 'right',
        stopOnFocus: true
    };

    this.success = function(message) {
        Toastify({
            ...defaultOptions,
            text: message,
            backgroundColor: '#4caf50'
        }).showToast();
    };

    this.error = function(message) {
        Toastify({
            ...defaultOptions,
            text: message,
            backgroundColor: '#f44336'
        }).showToast();
    };

    this.info = function(message) {
        Toastify({
            ...defaultOptions,
            text: message,
            backgroundColor: '#2196f3'
        }).showToast();
    };
}]);