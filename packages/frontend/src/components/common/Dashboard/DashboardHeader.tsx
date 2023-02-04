import { Button, Classes, Divider, Intent, Menu } from '@blueprintjs/core';
import { MenuItem2, Popover2, Tooltip2 } from '@blueprintjs/popover2';
import { Dashboard, Space, UpdatedByUser } from '@lightdash/common';
import { useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { useApp } from '../../../providers/AppProvider';
import { useTracking } from '../../../providers/TrackingProvider';
import { EventName } from '../../../types/Events';
import AddTileButton from '../../DashboardTiles/AddTileButton';
import ShareLinkButton from '../../ShareLinkButton';
import DashboardUpdateModal from '../modal/DashboardUpdateModal';
import {
    PageActionsContainer,
    PageDetailsContainer,
    PageHeaderContainer,
    PageTitle,
    PageTitleAndDetailsContainer,
    PageTitleContainer,
    SeparatorDot,
} from '../PageHeader';
import SpaceInfo from '../PageHeader/SpaceInfo';
import { UpdatedInfo } from '../PageHeader/UpdatedInfo';
import ViewInfo from '../PageHeader/ViewInfo';
import SpaceActionModal, { ActionType } from '../SpaceActionModal';

type DashboardHeaderProps = {
    spaces?: Space[];
    dashboardDescription?: string;
    dashboardName: string;
    dashboardSpaceName?: string;
    dashboardSpaceUuid?: string;
    dashboardUpdatedAt: Date;
    dashboardViews: number;
    dashboardUpdatedByUser?: UpdatedByUser;
    hasDashboardChanged: boolean;
    isEditMode: boolean;
    isSaving: boolean;
    onAddTiles: (tiles: Dashboard['tiles'][number][]) => void;
    onCancel: () => void;
    onSaveDashboard: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onMoveToSpace: (spaceUuid: string) => void;
};

const DashboardHeader = ({
    spaces = [],
    dashboardDescription,
    dashboardName,
    dashboardSpaceName,
    dashboardSpaceUuid,
    dashboardViews,
    dashboardUpdatedAt,
    dashboardUpdatedByUser,
    hasDashboardChanged,
    isEditMode,
    isSaving,
    onAddTiles,
    onCancel,
    onSaveDashboard,
    onDelete,
    onDuplicate,
    onMoveToSpace,
}: DashboardHeaderProps) => {
    const { projectUuid, dashboardUuid } = useParams<{
        projectUuid: string;
        dashboardUuid: string;
    }>();
    const history = useHistory();
    const { track } = useTracking();
    const [isUpdating, setIsUpdating] = useState(false);
    const [isCreatingNewSpace, setIsCreatingNewSpace] = useState(false);

    const handleEditClick = () => {
        setIsUpdating(true);
        track({ name: EventName.UPDATE_DASHBOARD_NAME_CLICKED });
    };

    const { user } = useApp();

    if (user.data?.ability?.cannot('manage', 'Dashboard')) return <></>;

    return (
        <PageHeaderContainer>
            <PageTitleAndDetailsContainer>
                <PageTitleContainer className={Classes.TEXT_OVERFLOW_ELLIPSIS}>
                    <PageTitle>{dashboardName}</PageTitle>

                    {dashboardDescription && (
                        <Tooltip2
                            content={dashboardDescription}
                            position="bottom"
                        >
                            <Button icon="info-sign" minimal />
                        </Tooltip2>
                    )}

                    {user.data?.ability?.can('manage', 'Dashboard') && (
                        <Button
                            icon="edit"
                            disabled={isSaving}
                            onClick={handleEditClick}
                            minimal
                        />
                    )}

                    <DashboardUpdateModal
                        uuid={dashboardUuid}
                        isOpen={isUpdating}
                        onClose={() => setIsUpdating(false)}
                        onConfirm={() => setIsUpdating(false)}
                    />
                </PageTitleContainer>

                <PageDetailsContainer>
                    <UpdatedInfo
                        updatedAt={dashboardUpdatedAt}
                        user={dashboardUpdatedByUser}
                    />

                    <SeparatorDot icon="dot" size={6} />

                    <ViewInfo views={dashboardViews} />

                    {dashboardSpaceName && (
                        <>
                            <SeparatorDot icon="dot" size={6} />

                            <SpaceInfo
                                link={`/projects/${projectUuid}/spaces/${dashboardSpaceUuid}`}
                                name={dashboardSpaceName}
                            />
                        </>
                    )}
                </PageDetailsContainer>
            </PageTitleAndDetailsContainer>

            {isEditMode ? (
                <PageActionsContainer>
                    <AddTileButton onAddTiles={onAddTiles} />

                    <Tooltip2
                        position="top"
                        content={
                            !hasDashboardChanged
                                ? 'No changes to save'
                                : undefined
                        }
                    >
                        <Button
                            text="Save"
                            disabled={!hasDashboardChanged || isSaving}
                            intent={Intent.PRIMARY}
                            onClick={onSaveDashboard}
                        />
                    </Tooltip2>

                    <Button
                        text="Cancel"
                        disabled={isSaving}
                        onClick={onCancel}
                    />
                </PageActionsContainer>
            ) : (
                <PageActionsContainer>
                    <Button
                        icon="edit"
                        text="Edit dashboard"
                        onClick={() => {
                            history.replace(
                                `/projects/${projectUuid}/dashboards/${dashboardUuid}/edit`,
                            );
                        }}
                    />

                    <ShareLinkButton
                        url={`${window.location.origin}/projects/${projectUuid}/dashboards/${dashboardUuid}/view`}
                    />

                    <Popover2
                        placement="bottom"
                        content={
                            <Menu>
                                <MenuItem2
                                    icon="duplicate"
                                    text="Duplicate"
                                    onClick={onDuplicate}
                                />

                                <MenuItem2
                                    icon="folder-close"
                                    text="Move to space"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                >
                                    {spaces?.map((spaceToMove) => {
                                        const isDisabled =
                                            dashboardSpaceUuid ===
                                            spaceToMove.uuid;
                                        return (
                                            <MenuItem2
                                                key={spaceToMove.uuid}
                                                text={spaceToMove.name}
                                                icon={
                                                    isDisabled
                                                        ? 'small-tick'
                                                        : undefined
                                                }
                                                className={
                                                    isDisabled
                                                        ? 'bp4-disabled'
                                                        : ''
                                                }
                                                onClick={(e) => {
                                                    // Use className disabled instead of disabled property to capture and preventdefault its clicks
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (
                                                        dashboardSpaceUuid !==
                                                        spaceToMove.uuid
                                                    ) {
                                                        onMoveToSpace(
                                                            spaceToMove.uuid,
                                                        );
                                                    }
                                                }}
                                            />
                                        );
                                    })}

                                    <Divider />

                                    <MenuItem2
                                        icon="plus"
                                        text="Create new"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsCreatingNewSpace(true);
                                        }}
                                    />
                                </MenuItem2>

                                <Divider />

                                <MenuItem2
                                    icon="cross"
                                    text="Delete"
                                    intent="danger"
                                    onClick={onDelete}
                                />
                            </Menu>
                        }
                    >
                        <Button icon="more" />
                    </Popover2>

                    {isCreatingNewSpace && (
                        <SpaceActionModal
                            projectUuid={projectUuid}
                            actionType={ActionType.CREATE}
                            title="Create new space"
                            confirmButtonLabel="Create"
                            icon="folder-close"
                            onClose={() => setIsCreatingNewSpace(false)}
                            onSubmitForm={(space) => {
                                if (space) onMoveToSpace(space.uuid);
                            }}
                        />
                    )}
                </PageActionsContainer>
            )}
        </PageHeaderContainer>
    );
};

export default DashboardHeader;
