import { subject } from '@casl/ability';
import {
    ForbiddenError,
    LightdashMode,
    NotExistsError,
    OnbordingRecord,
    Organisation,
    OrganizationMemberProfile,
    OrganizationMemberProfileUpdate,
    OrganizationProject,
    SessionUser,
} from '@lightdash/common';
import { analytics } from '../../analytics/client';
import { lightdashConfig } from '../../config/lightdashConfig';
import { InviteLinkModel } from '../../models/InviteLinkModel';
import { OnboardingModel } from '../../models/OnboardingModel/OnboardingModel';
import { OrganizationMemberProfileModel } from '../../models/OrganizationMemberProfileModel';
import { OrganizationModel } from '../../models/OrganizationModel';
import { ProjectModel } from '../../models/ProjectModel/ProjectModel';
import { UserModel } from '../../models/UserModel';

type OrganizationServiceDependencies = {
    organizationModel: OrganizationModel;
    projectModel: ProjectModel;
    onboardingModel: OnboardingModel;
    inviteLinkModel: InviteLinkModel;
    organizationMemberProfileModel: OrganizationMemberProfileModel;
    userModel: UserModel;
};

export class OrganizationService {
    private readonly organizationModel: OrganizationModel;

    private readonly projectModel: ProjectModel;

    private readonly onboardingModel: OnboardingModel;

    private readonly inviteLinkModel: InviteLinkModel;

    private readonly organizationMemberProfileModel: OrganizationMemberProfileModel;

    private readonly userModel: UserModel;

    constructor({
        organizationModel,
        projectModel,
        onboardingModel,
        inviteLinkModel,
        organizationMemberProfileModel,
        userModel,
    }: OrganizationServiceDependencies) {
        this.organizationModel = organizationModel;
        this.projectModel = projectModel;
        this.onboardingModel = onboardingModel;
        this.inviteLinkModel = inviteLinkModel;
        this.organizationMemberProfileModel = organizationMemberProfileModel;
        this.userModel = userModel;
    }

    async get(user: SessionUser): Promise<Organisation> {
        const needsProject = !(await this.projectModel.hasProjects(
            user.organizationUuid,
        ));

        const organisation = await this.organizationModel.get(
            user.organizationUuid,
        );
        return {
            ...organisation,
            needsProject,
        };
    }

    async updateOrg(
        { organizationUuid, organizationName, userUuid, ability }: SessionUser,
        data: Organisation,
    ): Promise<void> {
        if (
            ability.cannot(
                'update',
                subject('Organization', { organizationUuid }),
            )
        ) {
            throw new ForbiddenError();
        }
        if (organizationUuid === undefined) {
            throw new NotExistsError('Organization not found');
        }
        const org = await this.organizationModel.update(organizationUuid, data);
        analytics.track({
            userId: userUuid,
            event: 'organization.updated',
            properties: {
                type:
                    lightdashConfig.mode === LightdashMode.CLOUD_BETA
                        ? 'cloud'
                        : 'self-hosted',
                organizationId: organizationUuid,
                organizationName: org.name,
                defaultColourPaletteUpdated: data.chartColors !== undefined,
            },
        });
    }

    async delete(organizationUuid: string, user: SessionUser): Promise<void> {
        const organization = await this.organizationModel.get(organizationUuid);
        if (
            user.ability.cannot(
                'delete',
                subject('Organization', { organizationUuid }),
            )
        ) {
            throw new ForbiddenError();
        }

        const orgUsers =
            await this.organizationMemberProfileModel.getOrganizationMembers(
                organizationUuid,
            );

        const userUuids = orgUsers.map((orgUser) => orgUser.userUuid);

        await this.organizationModel.deleteOrgAndUsers(
            organizationUuid,
            userUuids,
        );

        orgUsers.forEach((orgUser) => {
            analytics.track({
                event: 'user.deleted',
                userId: orgUser.userUuid,
                properties: {
                    firstName: orgUser.firstName,
                    lastName: orgUser.lastName,
                    email: orgUser.email,
                    organizationId: organizationUuid,
                },
            });
        });

        analytics.track({
            event: 'organization.deleted',
            userId: user.userUuid,
            properties: {
                organizationId: organizationUuid,
                organizationName: organization.name,
                type:
                    lightdashConfig.mode === LightdashMode.CLOUD_BETA
                        ? 'cloud'
                        : 'self-hosted',
            },
        });
    }

    async getUsers(user: SessionUser): Promise<OrganizationMemberProfile[]> {
        const { organizationUuid } = user;
        if (user.ability.cannot('view', 'OrganizationMemberProfile')) {
            throw new ForbiddenError();
        }
        if (organizationUuid === undefined) {
            throw new NotExistsError('Organization not found');
        }
        const members =
            await this.organizationMemberProfileModel.getOrganizationMembers(
                organizationUuid,
            );
        return members.filter((member) =>
            user.ability.can(
                'view',
                subject('OrganizationMemberProfile', member),
            ),
        );
    }

    async getProjects(user: SessionUser): Promise<OrganizationProject[]> {
        const { organizationUuid } = user;
        if (organizationUuid === undefined) {
            throw new NotExistsError('Organization not found');
        }
        const projects = await this.projectModel.getAllByOrganizationUuid(
            organizationUuid,
        );

        return projects.filter((project) =>
            user.ability.can(
                'view',
                subject('Project', {
                    organizationUuid,
                    projectUuid: project.projectUuid,
                }),
            ),
        );
    }

    async getOnboarding(user: SessionUser): Promise<OnbordingRecord> {
        const { organizationUuid } = user;
        if (organizationUuid === undefined) {
            throw new NotExistsError('Organization not found');
        }
        return this.onboardingModel.getByOrganizationUuid(organizationUuid);
    }

    async setOnboardingSuccessDate(user: SessionUser): Promise<void> {
        const { shownSuccessAt } = await this.getOnboarding(user);
        if (shownSuccessAt) {
            throw new NotExistsError('Can not override "shown success" date');
        }
        return this.onboardingModel.update(user.organizationUuid, {
            shownSuccessAt: new Date(),
        });
    }

    async updateMember(
        authenticatedUser: SessionUser,
        memberUserUuid: string,
        data: OrganizationMemberProfileUpdate,
    ): Promise<OrganizationMemberProfile> {
        const { organizationUuid } = authenticatedUser;
        if (
            authenticatedUser.ability.cannot(
                'update',
                subject('OrganizationMemberProfile', { organizationUuid }),
            )
        ) {
            throw new ForbiddenError();
        }
        // Race condition between check and delete
        const [admin, ...remainingAdmins] =
            await this.organizationMemberProfileModel.getOrganizationAdmins(
                organizationUuid,
            );
        if (remainingAdmins.length === 0 && admin.userUuid === memberUserUuid) {
            throw new ForbiddenError(
                'Organization must have at least one admin',
            );
        }
        if (data.role !== undefined) {
            const organization = await this.organizationModel.get(
                organizationUuid,
            );
            analytics.track({
                userId: authenticatedUser.userUuid,
                event: 'permission.updated',
                properties: {
                    userId: authenticatedUser.userUuid,
                    userIdUpdated: memberUserUuid,
                    organizationPermissions: data.role,
                    projectPermissions: {
                        name: organization.name,
                        role: data.role,
                    },
                    newUser: false,
                    generatedInvite: false,
                },
            });
        }

        return this.organizationMemberProfileModel.updateOrganizationMember(
            organizationUuid,
            memberUserUuid,
            data,
        );
    }
}
