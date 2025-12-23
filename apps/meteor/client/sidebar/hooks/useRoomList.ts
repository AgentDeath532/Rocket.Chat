import type { ILivechatInquiryRecord } from '@rocket.chat/core-typings';
import { useDebouncedValue } from '@rocket.chat/fuselage-hooks';
import type { SubscriptionWithRoom, TranslationKey } from '@rocket.chat/ui-contexts';
import { useUserPreference, useUserSubscriptions, useSetting } from '@rocket.chat/ui-contexts';
import { useVideoConfIncomingCalls } from '@rocket.chat/ui-video-conf';
import { useMemo } from 'react';

import { useSortQueryOptions } from '../../hooks/useSortQueryOptions';
import { useOmnichannelEnabled } from '../../views/omnichannel/hooks/useOmnichannelEnabled';
import { useQueuedInquiries } from '../../views/omnichannel/hooks/useQueuedInquiries';

const query = { open: { $ne: false } };

const emptyQueue: ILivechatInquiryRecord[] = [];

const order = [
	'Incoming_Calls',
	'Incoming_Livechats',
	'Open_Livechats',
	'On_Hold_Chats',
	'Unread',
	'Favorites',
	'Teams',
	'Discussions',
	'Channels',
	'Direct_Messages',
	'Conversations',
] as const;

type useRoomListReturnType = {
	roomList: Array<SubscriptionWithRoom>;
	groupsCount: number[];
	groupsList: TranslationKey[];
	groupedUnreadInfo: Pick<
		SubscriptionWithRoom,
		'userMentions' | 'groupMentions' | 'unread' | 'tunread' | 'tunreadUser' | 'tunreadGroup' | 'alert' | 'hideUnreadStatus'
	>[];
};

export const useRoomList = ({ collapsedGroups }: { collapsedGroups?: string[] }): useRoomListReturnType => {
	const showOmnichannel = useOmnichannelEnabled();
	const sidebarGroupByType = useUserPreference('sidebarGroupByType');
	const favoritesEnabled = useUserPreference('sidebarShowFavorites');
	const sidebarOrder = useUserPreference<typeof order>('sidebarSectionsOrder') ?? order;
	const isDiscussionEnabled = useSetting('Discussion_enabled');
	const sidebarShowUnread = useUserPreference('sidebarShowUnread');

	const options = useSortQueryOptions();
	const rooms = useUserSubscriptions(query, options);
	const inquiries = useQueuedInquiries();
	const incomingCalls = useVideoConfIncomingCalls();
	const queue = inquiries.enabled ? inquiries.queue : emptyQueue;

	const { groupsCount, groupsList, roomList, groupedUnreadInfo } = useDebouncedValue(
		useMemo(() => {
			const isCollapsed = (groupTitle: string) => collapsedGroups?.includes(groupTitle);

			const incomingCall = new Set<SubscriptionWithRoom>();
			const favorite = new Set<SubscriptionWithRoom>();
			const team = new Set<SubscriptionWithRoom>();
			const omnichannel = new Set<SubscriptionWithRoom>();
			const unread = new Set<SubscriptionWithRoom>();
			const channels = new Set<SubscriptionWithRoom>();
			const direct = new Set<SubscriptionWithRoom>();
			const discussion = new Set<SubscriptionWithRoom>();
			const conversation = new Set<SubscriptionWithRoom>();
			const onHold = new Set<SubscriptionWithRoom>();

			// MAPPING: Ensure these exact channel names are moved to Teams
			const teamMapping: Record<string, string> = {
				"General Logs": "Scale Hosting Client Logs",
				"Anti Fraud": "Scale Hosting Client Logs",
				"Suspicious Accounts": "Scale Hosting Client Logs",
				"VPN Detected": "Scale Hosting Client Logs",
				"Blocked Registration": "Scale Hosting Client Logs",
				"Failed Logins": "Scale Hosting Client Logs",
				"IP Blocked": "Scale Hosting Client Logs",
				"Account Suspeneded": "Scale Hosting Client Logs",
				"Server-Abuse": "Scale Hosting Dev Panel Logs",
				"Server Delete": "Scale Hosting Dev Panel Logs",
				"Server Update": "Scale Hosting Dev Panel Logs",
				"Server Create": "Scale Hosting Dev Panel Logs",
				"Server Suspened": "Scale Hosting Dev Panel Logs",
				"Account Delete": "Scale Hosting Dev Panel Logs",
				"Account Login": "Scale Hosting Dev Panel Logs"
			};

			rooms.forEach((room) => {
				if (room.archived) {
					return;
				}

				if (incomingCalls.find((call) => call.rid === room.rid)) {
					return incomingCall.add(room);
				}

				if (sidebarShowUnread && (room.alert || room.unread || room.tunread?.length) && !room.hideUnreadStatus) {
					return unread.add(room);
				}

				if (favoritesEnabled && room.f) {
					return favorite.add(room);
				}

				if (sidebarGroupByType && room.teamMain) {
					return team.add(room);
				}

				// CUSTOM LOGIC: Intercept Mapped Channels
				const parentTeamName = teamMapping[room.name || ''];
				if (sidebarGroupByType && parentTeamName) {
					return team.add(room);
				}

				if (sidebarGroupByType && isDiscussionEnabled && room.prid) {
					return discussion.add(room);
				}

				if (room.t === 'c' || room.t === 'p') {
					return channels.add(room);
				}

				if (room.t === 'l' && room.onHold) {
					return showOmnichannel && onHold.add(room);
				}

				if (room.t === 'l') {
					return showOmnichannel && omnichannel.add(room);
				}

				if (room.t === 'd') {
					return direct.add(room);
				}

				conversation.add(room);
			});

			// SORTING: Nesting logic for the Team list
			const sortedTeamArray = [...team].sort((a: any, b: any) => {
				const aName = a.name || '';
				const bName = b.name || '';
				const aParent = teamMapping[aName];
				const bParent = teamMapping[bName];

				if (aParent === bName) return 1;
				if (bParent === aName) return -1;
				if (aParent && aParent === bParent) return aName.localeCompare(bName);
				return aName.localeCompare(bName);
			});

			const groups = new Map<string, Set<any>>();
			if (incomingCall.size) groups.set('Incoming_Calls', incomingCall);
			if (showOmnichannel && inquiries.enabled && queue.length) groups.set('Incoming_Livechats', new Set(queue));
			if (showOmnichannel && omnichannel.size) groups.set('Open_Livechats', omnichannel);
			if (showOmnichannel && onHold.size) groups.set('On_Hold_Chats', onHold);
			if (sidebarShowUnread && unread.size) groups.set('Unread', unread);
			if (favoritesEnabled && favorite.size) groups.set('Favorites', favorite);
			
			// Inject our sorted array into the Teams section
			if (sidebarGroupByType && sortedTeamArray.length) groups.set('Teams', new Set(sortedTeamArray));

			if (sidebarGroupByType && isDiscussionEnabled && discussion.size) groups.set('Discussions', discussion);
			if (sidebarGroupByType && channels.size) groups.set('Channels', channels);
			if (sidebarGroupByType && direct.size) groups.set('Direct_Messages', direct);
			if (!sidebarGroupByType) groups.set('Conversations', conversation);

			return sidebarOrder.reduce(
				(acc, key) => {
					const value = groups.get(key);
					if (!value) return acc;

					acc.groupsList.push(key as TranslationKey);

					const groupedUnreadInfoAcc = {
						userMentions: 0,
						groupMentions: 0,
						tunread: [],
						tunreadUser: [],
						unread: 0,
					};

					if (isCollapsed(key)) {
						const groupedUnreadInfo = [...value].reduce(
							(counter, room) => {
								if (room.hideUnreadStatus) return counter;
								counter.userMentions += room.userMentions || 0;
								counter.groupMentions += room.groupMentions || 0;
								counter.tunread = [...counter.tunread, ...(room.tunread || [])];
								counter.tunreadUser = [...counter.tunreadUser, ...(room.tunreadUser || [])];
								counter.unread += room.unread || 0;
								!room.unread && !room.tunread?.length && room.alert && (counter.unread += 1);
								return counter;
							},
							groupedUnreadInfoAcc,
						);

						acc.groupedUnreadInfo.push(groupedUnreadInfo);
						acc.groupsCount.push(0);
						return acc;
					}

					acc.groupedUnreadInfo.push(groupedUnreadInfoAcc);
					acc.groupsCount.push(value.size);
					acc.roomList.push(...value);
					return acc;
				},
				{
					groupsCount: [],
					groupsList: [],
					roomList: [],
					groupedUnreadInfo: [],
				} as useRoomListReturnType,
			);
		}, [
			rooms,
			showOmnichannel,
			inquiries.enabled,
			queue,
			sidebarShowUnread,
			favoritesEnabled,
			sidebarGroupByType,
			isDiscussionEnabled,
			sidebarOrder,
			collapsedGroups,
			incomingCalls,
		]),
		50,
	);

	return {
		roomList,
		groupsCount,
		groupsList,
		groupedUnreadInfo,
	};
};