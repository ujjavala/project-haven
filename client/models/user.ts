/* tslint:disable */
/* eslint-disable */
/**
 * Welcome to Haven - OpenAPI 3.0
 * This openapi spec contains details for apis in Haven
 *
 * OpenAPI spec version: 1.0.11
 * Contact: apiteam@swagger.io
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */

 /**
 * 
 *
 * @export
 * @interface User
 */
export interface User {

    /**
     * @type {number}
     * @memberof User
     * @example 10
     */
    id?: number;

    /**
     * @type {string}
     * @memberof User
     * @example jane_doe
     */
    username?: string;

    /**
     * @type {string}
     * @memberof User
     * @example Jane
     */
    firstName?: string;

    /**
     * @type {string}
     * @memberof User
     * @example Doe
     */
    lastName?: string;

    /**
     * @type {string}
     * @memberof User
     * @example john@email.com
     */
    email?: string;

    /**
     * @type {string}
     * @memberof User
     * @example olympic park
     */
    location?: string;

    /**
     * @type {string}
     * @memberof User
     * @example active
     */
    status?: string;

    /**
     * @type {boolean}
     * @memberof User
     * @example true
     */
    isVolunteer?: boolean;
}