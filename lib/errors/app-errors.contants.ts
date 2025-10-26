export enum ERROR_CODES {
    USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
    PERSON_ALREADY_EXISTS = 'PERSON_ALREADY_EXISTS',
    INVALID_DOCUMENT_TYPE = 'INVALID_DOCUMENT_TYPE',
    PERMISSION_ALREADY_EXISTS = 'PERMISSION_ALREADY_EXISTS',
    A_USER_HAS_THE_ROLE = 'A_USER_HAS_THE_ROLE'
}

export const ERRORS = {
    [ERROR_CODES.USER_ALREADY_EXISTS]: {
        code: ERROR_CODES.USER_ALREADY_EXISTS,
        message: 'The user already exists',
    },
    [ERROR_CODES.PERSON_ALREADY_EXISTS]: {
        code: ERROR_CODES.PERSON_ALREADY_EXISTS,
        message: 'The person already exists',
    },
    [ERROR_CODES.INVALID_DOCUMENT_TYPE]: {
        code: ERROR_CODES.INVALID_DOCUMENT_TYPE,
        message: 'Invalid document type',
    },
    [ERROR_CODES.PERMISSION_ALREADY_EXISTS]: {
        code: ERROR_CODES.PERMISSION_ALREADY_EXISTS,
        message: 'The permission already exists',
    },
    [ERROR_CODES.A_USER_HAS_THE_ROLE]: {
        code: ERROR_CODES.A_USER_HAS_THE_ROLE,
        message: 'A user has the role, you can not delete it',
    },
}