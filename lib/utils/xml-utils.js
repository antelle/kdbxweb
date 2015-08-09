'use strict';

var KdbxError = require('./../errors/kdbx-error'),
    Consts = require('./../defs/consts'),
    XmlNames = require('../defs/xml-names'),
    Uuid = require('./../format/uuid'),
    ProtectedValue = require('./../crypto/protected-value'),
    ByteUtils = require('./byte-utils');

/**
 * Gets first child node from xml
 * @param {Node} node - parent node for search
 * @param {string} tagName - child node tag name
 * @param {string} [errorMsgIfAbsent] - if set, error will be thrown if node is absent
 * @returns {Node} - first found node, or null, if there's no such node
 */
function getChildNode(node, tagName, errorMsgIfAbsent) {
    if (node && node.childNodes) {
        for (var i = 0, cn = node.childNodes, len = cn.length; i < len; i++) {
            if (cn[i].tagName === tagName) {
                return cn[i];
            }
        }
    }
    if (errorMsgIfAbsent) {
        throw new KdbxError(Consts.ErrorCodes.FileCorrupt, errorMsgIfAbsent);
    } else {
        return null;
    }
}

/**
 * Gets node inner text
 * @param {Node} node - xml node
 * @return {string|undefined} - node inner text or undefined, if the node is empty
 */
function getText(node) {
    if (!node || !node.childNodes) {
        return undefined;
    }
    return node.protectedValue ? node.protectedValue.text : node.textContent;
}

/**
 * Parses bytes saved by KeePass from XML
 * @param {Node} node - xml node with bytes saved by KeePass (base64 format)
 * @return {ArrayBuffer} - ArrayBuffer or undefined, if the tag is empty
 */
function getBytes(node) {
    var text = getText(node);
    return text ? ByteUtils.base64ToBytes(text).buffer : undefined;
}

/**
 * Parses date saved by KeePass from XML
 * @param {Node} node - xml node with date saved by KeePass (ISO format)
 * @return {Date} - date or undefined, if the tag is empty
 */
function getDate(node) {
    var text = getText(node);
    return text ? new Date(text) : undefined;
}

/**
 * Parses number saved by KeePass from XML
 * @param {Node} node - xml node with number saved by KeePass
 * @return {Number|undefined} - number or undefined, if the tag is empty
 */
function getNumber(node) {
    var text = getText(node);
    return text ? +text : undefined;
}

/**
 * Parses boolean saved by KeePass from XML
 * @param {Node} node - xml node with boolean saved by KeePass
 * @return {boolean|undefined} - boolean or undefined, if the tag is empty
 */
function getBoolean(node) {
    var text = getText(node);
    return text ? strToBoolean(text) : undefined;
}

/**
 * Converts saved string to boolean
 * @param {string} str
 * @returns {boolean}
 */
function strToBoolean(str) {
    return str === 'True';
}

/**
 * Parses Uuid saved by KeePass from XML
 * @param {Node} node - xml node with Uuid saved by KeePass
 * @return {Uuid} - Uuid or undefined, if the tag is empty
 */
function getUuid(node) {
    var bytes = getBytes(node);
    return bytes ? new Uuid(bytes) : undefined;
}

/**
 * Gets node protected text from inner text
 * @param {Node} node
 * @return {ProtectedValue|string}
 */
function getProtectedText(node) {
    return node.protectedValue || node.textContent;
}

/**
 * Gets node protected text from inner text
 * @param {Node} node
 * @return {ProtectedValue|ArrayBuffer}
 */
function getProtectedBinary(node) {
    if (node.protectedValue) {
        return node.protectedValue;
    }
    var text = node.textContent;
    return text ? ByteUtils.base64ToBytes(text).buffer : undefined;
}

/**
 * Traversed XML tree with depth-first preorder search
 * @param {Node} node
 * @param {function} callback
 */
function traverse(node, callback) {
    callback(node);
    for (var i = 0, cn = node.childNodes, len = cn.length; i < len; i++) {
        var childNode = cn[i];
        if (childNode.tagName) {
            traverse(childNode, callback);
        }
    }
}

/**
 * Reads protected values salt for all nodes in tree
 * @param {Node} node
 * @param {ProtectSaltGenerator} protectSaltGenerator
 */
function setProtectedValuesSalt(node, protectSaltGenerator) {
    traverse(node, function(node) {
        if (strToBoolean(node.getAttribute(XmlNames.Attr.Protected))) {
            try {
                var value = ByteUtils.base64ToBytes(node.textContent).buffer;
                if (value) {
                    var salt = protectSaltGenerator.getSalt(value.byteLength);
                    node.protectedValue = new ProtectedValue(value, salt);
                }
            } catch (e) {
                throw new KdbxError(Consts.ErrorCodes.FileCorrupt, 'bad protected value at line ' +
                    node.lineNumber + ': ' + e);
            }
        }
    });
}

module.exports.getChildNode = getChildNode;
module.exports.getText = getText;
module.exports.getBytes = getBytes;
module.exports.getDate = getDate;
module.exports.getNumber = getNumber;
module.exports.getBoolean = getBoolean;
module.exports.strToBoolean = strToBoolean;
module.exports.getUuid = getUuid;
module.exports.getProtectedText = getProtectedText;
module.exports.getProtectedBinary = getProtectedBinary;
module.exports.setProtectedValuesSalt = setProtectedValuesSalt;