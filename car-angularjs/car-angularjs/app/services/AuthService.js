angular.module('carApp')
.service('AuthService', [
    '$q', 
    '$state', 
    'UserService', 
    'ToastService', 
    'DatabaseService',
    function($q, $state, UserService, ToastService, DatabaseService) {
            const AUTH_KEY = 'car_rental_auth';
            let currentUser = null;

            // Helper function for password hashing
            async function hashPassword(password) {
                const encoder = new TextEncoder();
                const data = encoder.encode(password);
                console.log('Data:', data);
                const hash = await crypto.subtle.digest('SHA-256', data);
                console.log('Hash:', hash);
                return Array.from(new Uint8Array(hash))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
            }

            this.isAuthenticated = function() {
                try {
                    return !!sessionStorage.getItem('userSession');
                } catch (e) {
                    return false;
                }
            };

            // Initialize from storage
            try {
                const savedAuth = localStorage.getItem(AUTH_KEY);
                if (savedAuth) {
                    currentUser = JSON.parse(savedAuth);
                }
            } catch (error) {
                console.error('Error loading auth state:', error);
            }

            this.login = function(credentials) {
                return DatabaseService.getByIndex('users', 'email', credentials.email)
                    .then(async function(user) {
                        if (!user) {
                            return $q.reject('User not found');
                        }

                        const hashedPassword = await hashPassword(credentials.password);
                        if (user.password !== hashedPassword) {
                            return $q.reject('Invalid password');
                        }

                        const sessionUser = {
                            user_id: user.user_id,
                            name: user.name,
                            email: user.email,
                            role: user.role
                        };

                        // Store in session storage
                        sessionStorage.setItem('userSession', JSON.stringify(sessionUser));
                        return sessionUser;
                    });
            };

            this.register = async function(userData) {
                try {
                    const hashedPassword = await hashPassword(userData.password);
                    const userToCreate = {
                        ...userData,
                        password: hashedPassword,
                        role: 'user'
                    };

                    return UserService.createUser(userToCreate)
                        .then(() => {
                            ToastService.success('Registration successful');
                            return this.login({
                                email: userData.email,
                                password: userData.password
                            });
                        });
                } catch (error) {
                    ToastService.error('Registration failed: ' + error);
                    return $q.reject(error);
                }
            };

            this.logout = function() {
                sessionStorage.removeItem('userSession');
                ToastService.info('Logged out successfully');
                $state.go('login');
            };

            this.getCurrentUser = function() {
                const userSession = sessionStorage.getItem('userSession');
                return userSession ? JSON.parse(userSession) : null;
            };

            this.isAuthenticated = function() {
                return !!sessionStorage.getItem('userSession');
            };

            this.hasRole = function(role) {
                const user = this.getCurrentUser();
                return user && user.role === role;
            };

this.requireAuth = function(allowedRoles) {
    return $q(function(resolve, reject) {
        const userSession = sessionStorage.getItem('userSession');
        
        if (!userSession) {
            ToastService.error('Please login to continue');
            $state.go('login');
            return reject('Not authenticated');
        }

        const user = JSON.parse(userSession);
        
        if (!allowedRoles.includes(user.role)) {
            ToastService.error('You do not have permission to access this page');
            $state.go('home');
            return reject('Unauthorized role');
        }

        resolve(user);
    });
};

this.isAdmin = function() {
    try {
        const userSession = JSON.parse(sessionStorage.getItem('userSession'));
        return userSession && userSession.role === 'admin';
    } catch (e) {
        return false;
    }
};

this.requireAdmin = function() {
    return $q(function(resolve, reject) {
        try {
            const userSession = JSON.parse(sessionStorage.getItem('userSession'));
            
            if (!userSession) {
                ToastService.error('Please login to continue');
                $state.go('login');
                return reject('Not authenticated');
            }
            
            if (userSession.role !== 'admin') {
                ToastService.error('Admin access required');
                $state.go('home');
                return reject('Not authorized as admin');
            }
            
            resolve(userSession);
        } catch (error) {
            console.error('Error in requireAdmin:', error);
            ToastService.error('Authentication error');
            $state.go('login');
            reject(error);
        }
    });
};            
}]);
        
