/* tslint:disable */ 
import * as Primitive from '../../../xml-primitives';

// Source files:
// http://127.0.0.1:8998/ExDConfFile.xsd

interface BaseType {
	_exists: boolean;
	_namespace: string;
}
/** This type denotes the BIBI configuration used for this experiment. It is described using a reference to the BIBI model in the src attribute and an attribute processes to specify the number of processes that should be used to run the experiment. The default value for processes is 1. */
interface _BibiConf extends BaseType {
	/** The number of processes that should be used to run the neural network simulation. If this value is larger than 1, a dedicated simulation setup for distributed simulation of the neural network is used. */
	processes: number;
	/** The path to the BIBI configuration that specifies the model, the neural network and the connection between those. */
	src: string;
}
export interface BibiConf extends _BibiConf { constructor: new() => BibiConf; }
export var BibiConf: new() => BibiConf;

/** This type denotes a camera pose. Unlike the robot pose, a camera pose is specified using a position of the camera and a point to which the camera looks at. The camera is always rotated with the up vector z (0,0,1). */
interface _CameraPose extends BaseType {
	/** The position to which the camera should look at */
	cameraLookAt: Position;
	/** The position of the camera */
	cameraPosition: Position;
}
export interface CameraPose extends _CameraPose { constructor: new() => CameraPose; }
export var CameraPose: new() => CameraPose;

/** This type denotes a configuration entry. Configuration entries are used for multiple purposes, therefore the type of the configuration entry is set explicitly in an attribute called type. The actual configuration is referenced as a file through the src attribute. */
interface _ConfFile extends BaseType {
	/** The path to the file that acts as configuration. Files specified as configuration are automatically considered whe an experiment is deployed. */
	src: string;
	/** The type of the configuration entry describes what this entry is used for. The NRP allows both predefined and custom entries. */
	type: string;
}
export interface ConfFile extends _ConfFile { constructor: new() => ConfFile; }
export var ConfFile: new() => ConfFile;

/** This type denotes a configuration type which can be a standard configuration type or a custom type. The latter is just any string. */
export type ConfType = string;
type _ConfType = Primitive._string;

/** This enumeration lists the standard configuration types used in the NRP. */
export type ConfTypeEnumeration = '3d-settings';
interface _ConfTypeEnumeration extends Primitive._string { content: ConfTypeEnumeration; }

/** This type defines the necessary configuration for an environment. It combines the specification of an environment model through the src attribute and a robot pose using the element robotPose. */
interface _EnvironmentModel extends BaseType {
	/** Specifies the path to the custom model */
	customModelPath: string;
	/** A path to an SDF file that specifies the scene */
	src: string;
	/** The position of the robot */
	robotPose?: RobotPose[];
}
export interface EnvironmentModel extends _EnvironmentModel { constructor: new() => EnvironmentModel; }
export var EnvironmentModel: new() => EnvironmentModel;

/** This type is the root type for an experiment configuration. */
interface _ExD extends BaseType {
	/** The bibiConf element of an experiment configuration specifies the */
	bibiConf: BibiConf;
	/** The camera pose specifies the initial position of the camera when a simulation is started. */
	cameraPose?: CameraPose;
	/** If specified, the date when the experiment was cloned */
	cloneDate?: Date;
	/** An experiment may have multiple configuration entries. Despite configuration entries can be specified in anywhere in the ExD element, they must appear together. */
	configuration?: ConfFile[];
	/** This description will appear in the experiment description and provide a short description explaining what the experiment is all about. */
	description: string;
	/** The environment model of an experiment specifies the used world file for a simulation and the pose where the robot should be spawned. */
	environmentModel: EnvironmentModel;
	/** The experiment control lists all state machines that control the experiment. */
	experimentControl?: ExperimentControl;
	/** The experiment evaluation element lists all state machines that evaluate the success of a simulated experiment. */
	experimentEvaluation?: ExperimentControl;
	/** Settings for the relay of the component relaying information from the simulation backend to the visualization client. */
	gzbridgesettings?: GzBridgeSettings;
	/** The maturity of an experiment determines whether it is shown by default to the user or only browsable in dev mode. */
	maturity?: MaturityType;
	/** This element denotes the name of the experiment as it appears in the experiment list. */
	name: string;
	/** If specified, this element denotes the physics simulator that should be used. We currently support either ODE or OpenSim. */
	physicsEngine?: PhysicsEngine;
	/** If specified, this element specifies the random number generator seed. If this field is left blank, a seed is generated and therefore, the simulation is not 100% deterministic. If a seed is specified here, this seed is used for the robot and neural simulation, making the simulation much more deterministic. */
	rngSeed?: number;
	/** The roslaunch element species the path to a ROSLaunch file that is executed when the experiment is simulated. If no file is specified, no ROSLaunch file is executed at the beginning of an experiment. */
	rosLaunch?: RosLaunch;
	/** With the skin model, an experiment can specify a skin model for the frontend visualization. */
	skinModel?: SkinModel;
	/** List of space separated tags that describe the experiment. */
	tags?: Tags;
	/** This element references a path to a thumbnail that is used to give the user a forecast to the experiment. */
	thumbnail: string;
	/** The timeout of an experiment is the time an experiment is allowed to run by default, specified in seconds. If that time has elapsed, the users are asked whether they want to extend the runtime of the simulation. On the servers, this will only be allowed if the timeout fits within the cluster allocation. */
	timeout?: Timeout;
	/** With the visual model, an experiment can specify an alternatively used model for the frontend visualization. This is helpful in case the robot model used in gazebo is very detailed and thus hard to visualize on the client. On the server, there may be more resources available to simulate more complex models. */
	visualModel?: VisualModel;
}
export interface ExD extends _ExD { constructor: new() => ExD; }
export var ExD: new() => ExD;

/** This type depicts a list of state machines */
interface _ExperimentControl extends BaseType {
	/** The actual state machines of this list of state machines */
	stateMachine: StateMachine[];
}
export interface ExperimentControl extends _ExperimentControl { constructor: new() => ExperimentControl; }
export var ExperimentControl: new() => ExperimentControl;

interface _GzBridgeSettings extends BaseType {
	/** The angle delta by which a pose must change for it to be relayed to the frontend. */
	pose_update_delta_rotation?: number;
	/** The magnitude of translation delta by which a pose must change for it to be relayed to the frontend. */
	pose_update_delta_translation?: number;
	/** Maximal period during which larger thresholds are used rather than those defined in gzbridgesettings. */
	pose_update_early_threshold?: number;
}
export interface GzBridgeSettings extends _GzBridgeSettings { constructor: new() => GzBridgeSettings; }
export var GzBridgeSettings: new() => GzBridgeSettings;

/** This type denotes a maturity of an experiment. It can either be development or production. */
export type MaturityType = ('development' | 'production');
interface _MaturityType extends Primitive._string { content: MaturityType; }

/** This enumeration contains the physics engines supported by the NRP. This includes the standard physics engine ODE and OpenSim. */
export type PhysicsEngine = ('ode' | 'opensim');
interface _PhysicsEngine extends Primitive._string { content: PhysicsEngine; }

/** This type denotes a position with x, y and z coordinates. */
interface _Position extends BaseType {
	/** The x coordinate of the position */
	x: number;
	/** The y coordinate of the position */
	y: number;
	/** The z coordinate of the position */
	z: number;
}
export interface Position extends _Position { constructor: new() => Position; }
export var Position: new() => Position;

/** This type represents a robot pose. It consists of a position part (x, y and z coordinates in meters) and a rotation part (roll, pitch and yaw in radians). All fields are double precision values. */
interface _RobotPose extends BaseType {
	pitch?: number;
	/** Robot id the pose refers to */
	robotId?: string;
	roll?: number;
	theta?: number;
	ux?: number;
	uy?: number;
	uz?: number;
	/** The x coordinate of the robot position */
	x: number;
	/** The y coordinate of the robot position */
	y: number;
	yaw?: number;
	/** The z coordinate of the robot position */
	z: number;
}
export interface RobotPose extends _RobotPose { constructor: new() => RobotPose; }
export var RobotPose: new() => RobotPose;

/** This type denotes a Ros Launchfile configuration. */
interface _RosLaunch extends BaseType {
	/** The path to a ROSLaunch file */
	src: string;
}
export interface RosLaunch extends _RosLaunch { constructor: new() => RosLaunch; }
export var RosLaunch: new() => RosLaunch;

/** This type defines a skin model (for example for the robot) as used in the frontend. */
interface _SkinModel extends BaseType {
	src: string;
}
export interface SkinModel extends _SkinModel { constructor: new() => SkinModel; }
export var SkinModel: new() => SkinModel;

/** This type depicts a SMACH state machine. It is specified using a path to the source code of the state machine. */
interface _SMACHStateMachine extends _StateMachine {
	/** The path to an Python script that describes the state machine. This script has to have a variable with global scope that must have the name sm or stateMachine. */
	src: string;
}
export interface SMACHStateMachine extends _SMACHStateMachine { constructor: new() => SMACHStateMachine; }
export var SMACHStateMachine: new() => SMACHStateMachine;

/** This abstract type depicts a state machine. Currently, State Machines in SMACH or SCXML are supported, though state machines in SCXML are currently ignored. */
interface _StateMachine extends BaseType {
	/** Any state machine must have an identifier. This identifier is used to communicate with the state machine and therefore must be an identifier. */
	id: string;
}
export interface StateMachine extends _StateMachine { constructor: new() => StateMachine; }
export var StateMachine: new() => StateMachine;

export type Tags = string[];

/** This type denotes a path to an image file. The supported extensions are .png, .jpg, .jpeg and .gif. The file name must not contain whitespaces. */
export type ThumbnailFile = string;
type _ThumbnailFile = Primitive._string;

interface _Timeout extends Primitive._number {
	time: TimeoutTime;
}
export interface Timeout extends _Timeout { constructor: new() => Timeout; }
export var Timeout: new() => Timeout;

export type TimeoutTime = ('simulation' | 'real');
interface _TimeoutTime extends Primitive._string { content: TimeoutTime; }

/** This type defines a visual model (for example for the robot) as used in the frontend. */
interface _VisualModel extends BaseType {
	scale: number;
	src: string;
	visualPose: RobotPose;
}
export interface VisualModel extends _VisualModel { constructor: new() => VisualModel; }
export var VisualModel: new() => VisualModel;

export interface document extends BaseType {
	/** The root element of a experiment configuration model must be an ExD object. */
	ExD: ExD;
}
export var document: document;
