/*
 * Ioi is a named function that is Indication of Interest of certain financial products
 * @param {Object} message - The message object
 */
function placeExchangeOrder(command, params, item) {
    if (command === 'eo') {
        if (item.rid && (item.rid.indexOf("eqc.exchange") >= 0)) {
            if ((item.msg.indexOf('/eo bid ') === 0) || (item.msg.indexOf('/eo ask ') === 0)) {
                let msg = item;
                //is submitting exchange order
                let postUrl = 'http://localhost:3058/user/' + Meteor.userId() + '/eo/submit';
                HTTP.call('POST', postUrl, {data: msg.msg}, function (error, result) {
                    if (!error) {
                        console.log("TESTING 14: response from explorer app is: " + JSON.stringify(result));
                        msg.msg += ' - exchange order sent successfully';
                        Meteor.call('sendMessage', msg);
                    } else {
                        console.log("TESTING 14.2: response from api with err: " + JSON.stringify(error));
                        //TODO i18n me
                        if(error.response&&error.response.content) {
                            msg.msg += " - " + error.response.content;
                        }else{
                            msg.msg += " - " + "ERROR: Internal System Error."
                        }
                        Meteor.call('sendMessage', msg);
                    }
                });
            } else {
                return toastr.error("Your /eo message format is wrong");
            }
        } else {
            return toastr.error("Sorry it's not allowed to send exchange order to any one but EquiChain Exchange");
        }
    }
}

/**
 * handling msg like this
 * { "_id" : "L4Ysv4XDBb3Su5Eqo", "rid" : "GENERAL", "msg" : "[ ](http://localhost:3033/channel/general?msg=vp3z7CPRnxueL8Bwz)  lallala",
 * "ts" : ISODate("2017-08-07T07:39:36.641Z"), "u" : { "_id" : "tky7Ta4Fpkzwf9KG7", "username" : "mg" },
 * "urls" : [ { "url" : "http://localhost:3033/channel/general?msg=vp3z7CPRnxueL8Bwz", "ignoreParse" : true } ],
 * "attachments" : [ { "text" : "/ioi ask AAPL 1@105 CNY", "author_name" : "mg", "author_icon" : "/avatar/mg.jpg?_dc=0", "message_link" : "http://localhost:3033/channel/general?msg=vp3z7CPRnxueL8Bwz",
 * "ts" : ISODate("2017-08-04T03:35:55.386Z") } ],
 * "_updatedAt" : ISODate("2017-08-07T07:39:36.643Z") }
 * @param command
 * @param params
 * @param item
 */
function handleOtcDeal(command, params, item) {

    if (command === 'deal') {
        if (item.msg === '/deal confirm') {
            executeOtcDeal(command, params, item)
        } else if ((item.msg.indexOf('/deal bid ') === 0) || (item.msg.indexOf('/deal ask ') === 0)) {
            //check if format is correct, if so, save this message
            savePendingOtcDealMessage(command, params, item)
        } else {
            //TODO i18n me
            return toastr.error("Your /deal message format is wrong");
        }
    }
}

function executeOtcDeal(command, params, item) {
    //looking for last message in this same room
    if (command !== 'deal') {
        //TODO i18n me
        return toastr.error("Sorry, there's something wrong with our app's /deal message channelling, please kindly contract our support.");
    }
    if (params !== 'confirm') {
        //TODO i18n me
        return toastr.error("Sorry, there's something wrong with our app's /deal message channelling, please kindly contract our support.");
    }
    if (item.msg !== '/deal confirm') {
        return toastr.error("Sorry, there's something wrong with our app's /deal message channelling, please kindly contract our support.");
    }

    if (Meteor.isClient) {
        //do nothing and return
        return
    }
    isDirectChat(item)
        .then(function (chatToUser) {
            isLastMsgLegitOtcPendingDeal(item, chatToUser)
                .then(function (lastMsg) {
                    //PUBLISH TO EXPLORER TODO
                    //is submitting exchange order
                    let postUrl = 'http://localhost:3058/user/' + lastMsg.u._id + '/otc/submit';
                    lastMsg.counterpartyId = Meteor.userId();
                    console.log("Submitting otc deal to explorer", lastMsg);
                    HTTP.call('POST', postUrl,
                        {
                            //FIXME should also submit current user, who is counterparty of the initiator of the otc deal
                            data: lastMsg
                        },
                        function (error, result) {
                            if (!error) {
                                console.log("TESTING 14: response from explorer app is: " + JSON.stringify(result));
                                item.msg += ' - otc deal sent successfully';
                                Meteor.call('sendMessage', item);
                            } else {
                                console.log("TESTING 14.2: response from api with err: " + JSON.stringify(error));
                                //TODO i18n me
                                if(error.response&&error.response.content) {
                                    item.msg += " - " + error.response.content;
                                }else{
                                    item.msg += " - " + "ERROR: Internal System Error."
                                }
                                Meteor.call('sendMessage', item);
                            }
                        });
                })
                .catch(function (checkLastMsgErr) {
                    console.log("DEBUG checkLastMsgErr", checkLastMsgErr);
                    return toastr.error(checkLastMsgErr.toString());
                });
        })
        .catch(function (err) {
            //TODO i18n me
            console.error("check direct chat err: ", err);
            return toastr.error("/deal message can only be sent to Direct Message channels.");
        });
}

function isLastMsgLegitOtcPendingDeal(item, chatToUser) {
    return new Promise(function (resolve, reject) {
        let lastMsg = RocketChat.models.Messages.findOne(
            {
                rid: item.rid
            },
            {
                sort: {_updatedAt: -1}
            }
        );
        console.log("DEBUG LAST MSG", lastMsg);
        if (!lastMsg) {
            reject(new Error("Can't find last message to confirm for."));
            return
        } else {
            if (lastMsg.u._id === chatToUser._id) {
                //proceed to check message format
                if (isMessageInRightFormat(lastMsg.msg)) {
                    resolve(lastMsg);
                    return
                } else {
                    reject(new Error("Last msg not in right format as pending otc deal"));
                    return
                }
            } else {
                reject(new Error("Last msg not initiated by counterparty"));
                return
            }
        }
    })

}

function isMessageInRightFormat(itemMsg) {
    if (itemMsg.indexOf('/deal ') !== 0) {
        return false
    }

    let params = itemMsg.substring('/deal '.length);

    let splitMsgList = params.split(" ");
    if (splitMsgList.length === 4) {
        if (((splitMsgList[0] === "bid") || (splitMsgList[0] === "ask"))) {
            let quantity = splitMsgList[2].split("@")[0];
            let price = splitMsgList[2].split("@")[1];
            try {
                quantity = parseInt(quantity);
                price = parseInt(price);
                return (isInteger(quantity) && isInteger(price));
            } catch (parseIntErr) {
                //TODO i18n me
                console.error("parseIntErr", parseIntErr);
                return false;
            }
        } else {
            return false
        }
    } else {
        return false
    }
}

//FIXME toastr undefined problem
function savePendingOtcDealMessage(command, params, item) {
    /**
     * item.msg should be like '/deal bid AAPL 1@100 USD'
     */
    if (command !== 'deal') {
        //TODO i18n me
        return toastr.error("Sorry, there's something wrong with our app's /deal message channelling, please kindly contract our support.");
    }

    let splitMsgList = params.split(" ");
    if (splitMsgList.length === 4) {
        if (((splitMsgList[0] === "bid") || (splitMsgList[0] === "ask"))) {
            let quantity = splitMsgList[2].split("@")[0];
            let price = splitMsgList[2].split("@")[1];
            try {
                quantity = parseInt(quantity);
                price = parseInt(price);
            } catch (parseIntErr) {
                //TODO i18n me
                console.error("parseIntErr", parseIntErr);
                return toastr.error("Your /deal message format is wrong 001");
            }
            if (isInteger(quantity) && isInteger(price)) {
                if (Meteor.isClient) {
                    //do nothing and return
                    return
                }
                isDirectChat(item)
                    .then(function (chatToUser) {
                        console.log("Saving pending otc deal msg");
                        Meteor.call('sendMessage', item);
                        return
                    })
                    .catch(function (err) {
                        //TODO i18n me
                        console.error("check direct chat err: ", err);
                        item.msg += " - " + "ERROR: /deal message can only be sent to Direct Message channels.";
                        Meteor.call('sendMessage', item);
                        return
                    });
            } else {
                //TODO i18n me //TODO handle decimals
                return toastr.error("Your /deal message format is wrong. Check the price or quantity specified, they both need to be integers.");
            }


        } else {
            //TODO i18n me
            return toastr.error("Your /deal message format is wrong 002");
        }
    } else {
        //TODO i18n me
        return toastr.error("Your /deal message format is wrong 003");
    }
}

/**
 * @param item
 * @returns {Promise}
 */
function isDirectChat(item) {
    return new Promise(function (resolve, reject) {
        console.log("DEBUG isDirectChat check", JSON.stringify(item));
        if (item.rid.length === 34) {
            let thisUserId = Meteor.userId();
            let chatToUserId;
            if (item.rid.indexOf(thisUserId) === 0) {
                chatToUserId = item.rid.substring(17);
            } else {
                chatToUserId = item.rid.substring(0, 17);
            }
            let chatToUser = Meteor.users.findOne(chatToUserId);
            if (chatToUser) {
                if (chatToUser &&
                    //assume admin to be real user as well
                    (chatToUser.type === "user")) {
                    resolve(chatToUser);
                    return
                }
            }

            //FIXME this message seems to be fired twice after the first one succeeds
            console.error("not direct chat 001");
            reject(new Error("not direct chat: ", item));
            return
        } else {
            console.error("not direct chat 002");
            reject(new Error("not direct chat: ", item));
            return
        }
    });
}

function isInteger(data) {
    return data === parseInt(data, 10);
}

RocketChat.slashCommands.add('eo', placeExchangeOrder, {
    description: 'Slash_Eo_Description',
    params: 'bid/ask ticker quantity@per_unit_price settlement_currency (e.g. bid YAHOO 1000@100 USD)'
});

RocketChat.slashCommands.add('deal', handleOtcDeal, {
    description: 'Slash_Deal_Description',
    params: 'bid/ask ticker quantity@per_unit_price settlement_currency (e.g. bid YAHOO 1000@100 USD)'
});