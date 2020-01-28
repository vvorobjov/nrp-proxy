/**---LICENSE-BEGIN - DO NOT CHANGE OR MOVE THIS HEADER
 * This file is part of the Neurorobotics Platform software
 * Copyright (C) 2014,2015,2016,2017 Human Brain Project
 * https://www.humanbrainproject.eu
 *
 * The Human Brain Project is a European Commission funded project
 * in the frame of the Horizon2020 FET Flagship plan.
 * http://ec.europa.eu/programmes/horizon2020/en/h2020-section/fet-flagships
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 * ---LICENSE-END**/
'use strict';

export type FileType = 'file' | 'folder';

export type File = {
  name: string;
  uuid: string;
  size: number;
  type: FileType;
  modifiedOn: number;
};

export default abstract class BaseStorage {

  abstract listFiles(experiment, token, userId): File[];
  abstract getFile(filename, experiment, token, userId, byname);
  abstract deleteFile(filename, experiment, token, userId, byname);
  abstract deleteFolder(foldername, experiment, token, userId, byname);
  abstract createFolder(foldername, experiment, token, userId);
  abstract deleteExperiment(experimentName, parentDir, token, userId);
  abstract createOrUpdate(
    filename,
    fileContent,
    contentType,
    experiment,
    token,
    userId
  );

  abstract listAllModels(modelType, userId);
  abstract addUsertoSharingUserListinModel(modelType, modelName, userId);
  abstract listSharingUsersbyModel(modelType, modelID);

  abstract updateSharedModelMode(modelType, modelID, sharingOption);
  abstract getModelSharingMode(modelType, modelID);
  abstract deleteSharingUserFromModel(modelType, modelID, userId);
  abstract listSharedModels(modelType, userId);
  abstract listUserModelsbyType(modelType, token, userId);

  abstract isDirectory(fileSystemEntry);

  abstract getExperimentSharingMode(experimentID);

  abstract updateSharedExperimentMode(experimentID, sharingOption);
  abstract listSharingUsersbyExperiment(experimentID);

  abstract listExperimentsSharedByUsers(userId);

  abstract deleteSharingUserFromExperiment(experimentId, userId);
  abstract addUsertoSharingUserListinExperiment(newExperiment, userId);
  abstract copyFolderContents(contents, destFolder);

  abstract createCustomModel(modelType, modelData, userId, modelName, token, contextId);
  abstract createExperiment(newExperiment, token, userId, contextId);
  abstract getModelFolder(modelType, modelName, userId);
  abstract copyExperiment(experiment, token, userId, contextId);
  abstract listExperiments(token, userId, contextId, options);
  abstract createUniqueExperimentId(token, userId, expPath, contextId);
  abstract extractZip(zip, destFoldername);
  abstract insertExperimentInDB(userId, foldername);
  abstract getStoragePath();
  abstract createOrUpdateKgAttachment(filename, content);
  abstract getKgAttachment(filename);
}
