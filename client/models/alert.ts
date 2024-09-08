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
 * @interface Alert
 */
export interface Alert {

    /**
     * @type {number}
     * @memberof Alert
     * @example 10
     */
    id?: number;

    /**
     * @type {string}
     * @memberof Alert
     * @example Bushfire 2km away
     */
    description?: string;

    /**
     * @type {string}
     * @memberof Alert
     * @example James
     */
    createdAt?: string;

    /**
     * @type {string}
     * @memberof Alert
     */
    deletedAt?: string;

    /**
     * @type {string}
     * @memberof Alert
     */
    type?: string;

    /**
     * @type {string}
     * @memberof Alert
     */
    mapUrl?: string;
}
