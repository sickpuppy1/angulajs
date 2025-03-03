angular.module('carApp')
.service('UserService', ['$q', 'DatabaseService', function($q, DatabaseService) {
    
    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    this.registerUser = async function(userData) {
        try {
            // Check if user already exists
            const existingUser = await DatabaseService.getByIndex('users', 'email', userData.email);
            if (existingUser) {
                return $q.reject('Email already registered');
            }

            const hashedPassword = await hashPassword(userData.password);
            
            const newUser = {
                user_id: 'user_' + new Date().getTime(),
                name: userData.name,
                email: userData.email,
                password: hashedPassword,
                mobile: userData.mobile,
                role: 'user',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: {
                    status: 'active',
                    verification_status: 'pending'
                }
            };

            return DatabaseService.add('users', newUser);
        } catch (error) {
            return $q.reject(error.message || 'Registration failed');
        }
    };

    this.getUserByEmail = function(email) {
        return DatabaseService.getByIndex('users', 'email', email);
    };

    this.createUser = function(userData) {
        const newUser = {
            ...userData,
            user_id: 'user_' + new Date().getTime(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        return DatabaseService.add('users', newUser);
    };

    this.updateUser = function(userData) {
        return DatabaseService.update('users', {
            ...userData,
            updated_at: new Date().toISOString()
        });
    };

    this.updateUserRole = function(userId, newRole) {
        if (!userId || !newRole) {
            return $q.reject('User ID and new role are required');
        }

        // Validate role
        const validRoles = ['user', 'owner', 'admin'];
        if (!validRoles.includes(newRole)) {
            return $q.reject('Invalid role. Must be one of: ' + validRoles.join(', '));
        }

        return this.getUserById(userId)
            .then(function(user) {
                if (!user) {
                    return $q.reject('User not found');
                }

                // Update the user's role
                user.role = newRole;
                user.updated_at = new Date().toISOString();
                user.metadata = {
                    ...user.metadata,
                    role_updated_at: new Date().toISOString(),
                    previous_role: user.role
                };

                // Save the updated user
                return DatabaseService.update('users', user);
            })
            .catch(function(error) {
                console.error('Error updating user role:', error);
                return $q.reject('Failed to update user role: ' + error);
            });
    };

    this.getUserById = function(userId) {
        return DatabaseService.get('users', userId);
    };

    this.getAllUsers = function() {
        return DatabaseService.getAll('users')
            .then(function(users) {
                return users || [];
            })
            .catch(function(error) {
                console.error('Error getting all users:', error);
                return $q.reject('Failed to fetch users: ' + error);
            });
    };

    this.getUsersByRole = function(role) {
        return this.getAllUsers()
            .then(function(users) {
                return users.filter(user => user.role === role);
            })
            .catch(function(error) {
                console.error('Error getting users by role:', error);
                return $q.reject('Failed to fetch users by role: ' + error);
            });
    };

    this.updateUserStatus = function(userId, isBlocked) {
        return this.getUserById(userId)
            .then(function(user) {
                if (!user) {
                    return $q.reject('User not found');
                }
                
                // Update the user's status
                if (!user.metadata) {
                    user.metadata = {};
                }
                
                user.metadata.status = isBlocked ? 'blocked' : 'active';
                user.blocked = isBlocked;
                user.updated_at = new Date().toISOString();
                
                return DatabaseService.update('users', user);
            })
            .catch(function(error) {
                console.error('Error updating user status:', error);
                return $q.reject('Failed to update user status: ' + error);
            });
    };

    this.getUserStatistics = function() {
        return this.getAllUsers()
            .then(function(users) {
                return {
                    totalUsers: users.length,
                    activeUsers: users.filter(u => !u.blocked && u.metadata && u.metadata.status === 'active').length,
                    blockedUsers: users.filter(u => u.blocked || (u.metadata && u.metadata.status === 'blocked')).length,
                    usersByRole: {
                        admin: users.filter(u => u.role === 'admin').length,
                        owner: users.filter(u => u.role === 'owner').length,
                        user: users.filter(u => u.role === 'user').length
                    }
                };
            });
    };
}]);