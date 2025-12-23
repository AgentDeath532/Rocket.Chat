import { Box } from '@rocket.chat/fuselage';
import { useResizeObserver } from '@rocket.chat/fuselage-hooks';
import { VirtualizedScrollbars } from '@rocket.chat/ui-client';
import { useUserPreference, useUserId } from '@rocket.chat/ui-contexts';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GroupedVirtuoso } from 'react-virtuoso';

import RoomListCollapser from './RoomListCollapser';
import RoomListRow from './RoomListRow';
import RoomListRowWrapper from './RoomListRowWrapper';
import RoomListWrapper from './RoomListWrapper';
import { useOpenedRoom } from '../../lib/RoomManager';
import { useAvatarTemplate } from '../hooks/useAvatarTemplate';
import { useCollapsedGroups } from '../hooks/useCollapsedGroups';
import { usePreventDefault } from '../hooks/usePreventDefault';
import { useRoomList } from '../hooks/useRoomList';
import { useShortcutOpenMenu } from '../hooks/useShortcutOpenMenu';
import { useTemplateByViewMode } from '../hooks/useTemplateByViewMode';

const RoomList = () => {
    const { t } = useTranslation();
    const isAnonymous = !useUserId();

    const { collapsedGroups, handleClick, handleKeyDown } = useCollapsedGroups();
    const { groupsCount, groupsList, roomList, groupedUnreadInfo } = useRoomList({ collapsedGroups });
    const avatarTemplate = useAvatarTemplate();
    const sideBarItemTemplate = useTemplateByViewMode();
    const { ref } = useResizeObserver<HTMLElement>({ debounceDelay: 100 });
    const openedRoom = useOpenedRoom() ?? '';
    const sidebarViewMode = useUserPreference<'extended' | 'medium' | 'condensed'>('sidebarViewMode') || 'extended';

    // MANUAL MAPPING LOGIC FOR NESTING
    const channelToTeamMap: Record<string, string> = {
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

    const extended = sidebarViewMode === 'extended';
    const itemData = useMemo(
        () => ({
            extended,
            t,
            SidebarItemTemplate: sideBarItemTemplate,
            AvatarTemplate: avatarTemplate,
            openedRoom,
            sidebarViewMode,
            isAnonymous,
            // Pass the map to the row renderer
            channelToTeamMap,
        }),
        [avatarTemplate, extended, isAnonymous, openedRoom, sideBarItemTemplate, sidebarViewMode, t],
    );

    usePreventDefault(ref);
    useShortcutOpenMenu(ref);

    return (
        <Box position='relative' overflow='hidden' height='full' ref={ref}>
            <VirtualizedScrollbars>
                <GroupedVirtuoso
                    groupCounts={groupsCount}
                    groupContent={(index) => {
                        const title = groupsList[index];
                        
                        // HIDE "CHANNELS" HEADER
                        if (title === 'Channels') {
                            return <Box height="0px" overflow="hidden" />;
                        }

                        return (
                            <RoomListCollapser
                                collapsedGroups={collapsedGroups}
                                onClick={() => handleClick(groupsList[index])}
                                onKeyDown={(e) => handleKeyDown(e, groupsList[index])}
                                groupTitle={groupsList[index]}
                                unreadCount={groupedUnreadInfo[index]}
                            />
                        );
                    }}
                    {...(roomList.length > 0 && {
                        itemContent: (index) => {
                            const room = roomList[index];
                            if (!room) return null;

                            // Identify if this room should have a "nested" style
                            const isNested = !!channelToTeamMap[room.name || ''];

                            return (
                                <Box className={isNested ? 'is-nested-room' : ''}>
                                    <RoomListRow data={itemData} item={room} />
                                </Box>
                            );
                        },
                    })}
                    components={{ Item: RoomListRowWrapper, List: RoomListWrapper }}
                />
            </VirtualizedScrollbars>
        </Box>
    );
};

export default RoomList;