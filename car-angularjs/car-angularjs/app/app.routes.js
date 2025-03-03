angular.module('carApp')
.run(['$rootScope', 'AuthService', function($rootScope, AuthService) {
    $rootScope.isAuthenticated = AuthService.isAuthenticated;
}])
angular.module('carApp').config(['$stateProvider', '$urlRouterProvider','$locationProvider',
function($stateProvider, $urlRouterProvider, $locationProvider) {
  $locationProvider.html5Mode(true);
    // Default route
    $urlRouterProvider.otherwise('/login');

    $stateProvider
        .state('home', {
            url: '/home',
            templateUrl: './app/components/home/home.html',
            controller: 'HomeController',
            controllerAs: 'vm'
        })
        .state('add-car', {
            url: '/add-car',
            templateUrl: 'app/components/add-car/add-car.html',
            controller: 'AddCarController',
            controllerAs: 'vm',
            resolve: {
                auth: ['AuthService', '$state', function(AuthService, $state) {
                    if (!AuthService.isAuthenticated()) {
                        return $state.go('login');
                    }
                }]
            }
        })
        .state('login', {
            url: '/login',
            templateUrl: './app/components/auth/login.html',
            controller: 'LoginController',
            controllerAs: 'vm'
        })
        .state('register', {
            url: '/register',
            templateUrl: './app/components/auth/register.html',
            controller: 'RegisterController',
            controllerAs: 'vm'
        })
        .state('carDetails', {
            url: '/car-details/:id',
            templateUrl: 'app/components/car-details/car-details.html',
            controller: 'CarDetailsController',
            controllerAs: 'vm',
            resolve: {
                carData: ['CarService', '$stateParams', '$q', function(CarService, $stateParams, $q) {
                    return CarService.getCarById($stateParams.id)
                        .catch(function(error) {
                            return $q.reject('Unable to load car details: ' + error);
                        });
                }]
            }
        })
        .state('manage-listings', {
            url: '/manage-listings',
            templateUrl: 'components/manage-listings/manage-listings.html',
            controller: 'ManageListingsController as vm',
            resolve: {
                auth: ['AuthService', function(AuthService) {
                    return AuthService.requireAuth(['owner']);
                }]
            }
        })
        .state('messages', {
          url: '/messages',
          templateUrl: 'components/messages/messages.html',
          controller: 'MessagesController as vm',
          resolve: {
            auth: ['AuthService', '$state', function(AuthService, $state) {
                if (!AuthService.isAuthenticated()) {
                    return $state.go('login');
                }
            }]
        }
      })
        .state('my-bids', {
          url: '/my-bids',
          templateUrl: 'components/my-bids/my-bids.html',
          controller: 'MyBidsController as vm'
      })
      .state('admin', {
        url: '/admin',
        templateUrl: 'app/components/admin/admin.html',
        controller: 'AdminController',
        controllerAs: 'vm',
        resolve: {
            auth: ['AuthService', function(AuthService) {
                return AuthService.requireAdmin();
            }]
        }
    })
    // Add nested states for admin dashboard tabs
    .state('admin.analysis', {
        url: '/analysis',
        templateUrl: 'app/components/admin/tabs/analysis/analysis.html',
        controller: 'AnalysisController',
        controllerAs: 'vm'
    })
    .state('admin.listings', {
        url: '/listings',
        templateUrl: 'app/components/admin/tabs/listings/listings.html',
        controller: 'ListingsController',
        controllerAs: 'vm'
    })
    .state('admin.owners', {
        url: '/owners',
        templateUrl: 'app/components/admin/tabs/owners/owners.html',
        controller: 'OwnersController',
        controllerAs: 'vm'
    });

    // When accessing /admin directly, redirect to the analysis tab
    $urlRouterProvider.when('/admin', '/admin/analysis');
}]);