import _ from 'underscore';
import {
    Meteor
} from 'meteor/meteor';
import {
    check
} from 'meteor/check';
import {
    Email
} from 'meteor/email';

import {
    Parties, PartiesValues
} from './collection';

function getContactEmail(user) {
    if (user) {
        if (user.emails && user.emails.length)
            return user.emails[0].address;

        if (user.services && user.services.facebook && user.services.facebook.email)
            return user.services.facebook.email;

        if (user.services && user.services.google && user.services.google.email)
            return user.services.facebook.email;
    }
    return null;
}

// Remember this refers to Meteor, eg: this.userId == Meteor.userId()
export function invite(partyId, userId) {
    check(partyId, String);
    check(userId, String);

    if (!this.userId) {
        throw new Meteor.Error(400, 'You have to be logged in!');
    }

    const party = Parties.findOne(partyId);

    if (!party || party.owner !== this.userId) {
        throw new Meteor.Error(404, 'No permissions!');
    }

    if (party.public) {
        throw new Meteor.Error(400, 'That party is public. No need to invite people.');
    }

    if (userId !== party.owner && !_.contains(party.invited, userId)) {
        Parties.update(partyId, {
            $addToSet: {
                invited: userId
            }
        });

        const replyTo = getContactEmail(Meteor.users.findOne(this.userId));
        const to = getContactEmail(Meteor.users.findOne(userId));

        if (Meteor.isServer && to) {
            Email.send({
                to,
                replyTo,
                from: 'noreply@socially.com',
                subject: `PARTY: ${party.name}`,
                text: `
          Hey, I just invited you to ${party.name} on Socially.
          Come check it out: ${Meteor.absoluteUrl()}
                      `
            });
        }
    }
}

export function rsvp(partyId, rsvp) {
    check(partyId, String);
    check(rsvp, String);

    if (!this.userId) {
        throw new Meteor.Error(403, 'You must be logged in to RSVP');
    }

    if (!_.contains(['yes', 'no', 'maybe'], rsvp)) {
        throw new Meteor.Error(400, 'Invalid RSVP');
    }

    const party = Parties.findOne({
        _id: partyId,
        $or: [{
            // is public
            $and: [{
                public: true
            }, {
                public: {
                    $exists: true
                }
            }]
        }, {
            // is owner
            $and: [{
                owner: this.userId
            }, {
                owner: {
                    $exists: true
                }
            }]
        }, {
            // is invited
            $and: [{
                invited: this.userId
            }, {
                invited: {
                    $exists: true
                }
            }]
        }]
    });

    if (!party) {
        throw new Meteor.Error(404, 'No such party');
    }

    const hasUserRsvp = _.findWhere(party.rsvps, {
        user: this.userId
    });

    if (!hasUserRsvp) {
        // add new rsvp entry
        Parties.update(partyId, {
            $push: {
                rsvps: {
                    rsvp,
                    user: this.userId
                }
            }
        });
    } else {
        // update rsvp entry
        const userId = this.userId;
        Parties.update({
            _id: partyId,
            'rsvps.user': userId
        }, {
            $set: {
                'rsvps.$.rsvp': rsvp
            }
        });
    }
}

export function numberPartiesUpdate(number){
    Meteor.users.update({
        _id: Meteor.userId()
    }, {
        $set: {
            "profile.numberParties": number
        }
    });
}

Meteor.methods({
    invite,
    rsvp,
    numberPartiesUpdate
});
