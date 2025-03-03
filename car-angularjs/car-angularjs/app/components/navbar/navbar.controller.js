angular.module('carApp')
.controller('NavbarController', [
    '$scope', 
    '$rootScope', 
    '$state', 
    'AuthService',
function($scope, $rootScope, $state, AuthService) {
    var vm = this;
    $rootScope.userSession = JSON.parse(sessionStorage.getItem('userSession'));
    
    vm.logout = function() {
        sessionStorage.removeItem('userSession');
        vm.userSession = null;
        $state.go('home');
    };

    vm.isAdmin = function() {
        return AuthService.isAdmin();
    };

    // Listen for login/logout events
    $rootScope.$on('userLoggedIn', function(event, userData) {
        vm.userSession = userData;
    });

    $rootScope.$on('userLoggedOut', function() {
        vm.userSession = null;
    });
}]);