'use strict';

const boom = require('boom');
const joi = require('joi');
const schema = require('screwdriver-data-schema');
const getSchema = joi.array().items(schema.models.token.get);

module.exports = () => ({
    method: 'GET',
    path: '/pipelines/{id}/tokens',
    config: {
        description: 'List tokens for pipeline',
        notes: 'List tokens for a specific pipeline',
        tags: ['api', 'tokens'],
        auth: {
            strategies: ['token'],
            scope: ['user', '!guest']
        },
        plugins: {
            'hapi-swagger': {
                security: [{ token: [] }]
            }
        },
        handler: (request, reply) => {
            const pipelineFactory = request.server.app.pipelineFactory;
            const userFactory = request.server.app.userFactory;
            const username = request.auth.credentials.username;
            const scmContext = request.auth.credentials.scmContext;

            return Promise.all([
                pipelineFactory.get(request.params.id),
                userFactory.get({ username, scmContext })
            ])
                .then(([pipeline, user]) => {
                    if (!pipeline) {
                        throw boom.notFound('Pipeline does not exist');
                    }

                    if (!user) {
                        throw boom.notFound('User does not exist');
                    }

                    return user.getPermissions(pipeline.scmUri).then((permissions) => {
                        if (!permissions.admin) {
                            throw boom.unauthorized(`User ${username} `
                                + 'is not an admin of this repo');
                        }

                        return pipeline.tokens;
                    });
                })
                .then(tokens => reply(tokens.map((token) => {
                    const output = token.toJson();

                    delete output.userId;
                    delete output.pipelineId;

                    return output;
                })))
                .catch(err => reply(boom.wrap(err)));
        },
        response: {
            schema: getSchema
        }
    }
});
