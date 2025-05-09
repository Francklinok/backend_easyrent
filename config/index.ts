import base from './base';
import  dev from './env/developpement'
import  prod from './env/production'


const env = process.env.NODE_ENV || 'development';

const envConfig = {
  development: dev,
  production: prod,
};

export default {
  ...base,
  ...(envConfig[env] || {}),
};


git add .
git commit -m "feat(user): complete implementation of user service with creation, update, verification, password reset, and search

- Created UserService with full user lifecycle management
- Integrated DTOs: CreateUserDto, UpdateUserDto, and SearchUsersParams
- Implemented methods: create, update, deactivate, reactivate, verify, password reset and password change
- Added advanced user search with filters (role, status, city, country)
"