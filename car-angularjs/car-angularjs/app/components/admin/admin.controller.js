angular.module('carApp')
.controller('AdminController', [
    '$state',
    'StyleLoaderService',
    'AuthService',
    'ToastService',
    function($state, StyleLoaderService, AuthService, ToastService) {
        const vm = this;
        
        /**
         * @description Initialize the admin controller
         * Loads shared resources and sets up initial state
         */
        vm.init = function() {
            // Load the admin dashboard core CSS
            StyleLoaderService.loadStylesheet('app/components/admin/admin.css')
                .catch(error => {
                    console.error('Failed to load admin styles:', error);
                });
                
            // Redirect to analysis tab if on the base admin route
            if ($state.current.name === 'admin') {
                $state.go('admin.analysis');
            }
        };

        /**
         * @description Handle user logout
         * Clears session and redirects to login
         */
        vm.logout = function() {
            AuthService.logout()
                .then(() => {
                    ToastService.success('Logged out successfully');
                    $state.go('login');
                })
                .catch(error => {
                    console.error('Logout failed:', error);
                    ToastService.error('Failed to logout');
                });
        };
    }
]);