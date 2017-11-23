import * as Primitive from '../../../../xml-primitives';

// Source files:
// http://127.0.0.1:8998/hbp-scxml/hbp-scxml-attribs.xsd
// http://127.0.0.1:8998/hbp-scxml/hbp-scxml-contentmodels.xsd
// http://127.0.0.1:8998/hbp-scxml/hbp-scxml-datatypes.xsd
// http://127.0.0.1:8998/hbp-scxml/hbp-scxml-event-mapping.xsd
// http://127.0.0.1:8998/hbp-scxml/hbp-scxml-module-core.xsd
// http://127.0.0.1:8998/hbp-scxml/hbp-scxml-module-data.xsd
// http://127.0.0.1:8998/hbp-scxml/hbp-scxml-module-external.xsd
// http://127.0.0.1:8998/hbp-scxml/hbp-scxml.xsd


interface BaseType {
	_exists: boolean;
	_namespace: string;
}
/** The assign type that allows for precise manipulation of the
  * datamodel location. Types are:
  * replacechildren (default),
  * firstchild, lastchild,
  * previoussibling, nextsibling,
  * replace, delete,
  * addattribute */
export type AssignTypedatatype = ("replacechildren" | "firstchild" | "lastchild" | "previoussibling" | "nextsibling" | "replace" | "delete" | "addattribute");
interface _AssignTypedatatype extends Primitive._string { content: AssignTypedatatype; }

/** The binding type in use for the SCXML document. */
export type Bindingdatatype = ("early" | "late");
interface _Bindingdatatype extends Primitive._string { content: Bindingdatatype; }

/** Boolean: true or false only */
export type Booleandatatype = ("true" | "false");
interface _Booleandatatype extends Primitive._string { content: Booleandatatype; }

/** Conditional language is expression
  * which must evaluate to Boolean True or False.
  * The expression language must define In(stateID)
  * as a valid expression. */
export type CondLangdatatype = string;
type _CondLangdatatype = Primitive._string;

/** Duration allowing positive values ranging from milliseconds
  * to days. */
export type Durationdatatype = string;
type _Durationdatatype = Primitive._string;

/** EventType is the name of an event.
  * Example legal values:
  * foo
  * foo.bar
  * foo.bar.baz */
export type EventTypedatatype = string;
type _EventTypedatatype = Primitive._string;

/** Custom datatype for the event attribute in SCXML based on xsd:token.
  * Example legal values:
  * *
  * foo
  * foo.bar
  * foo.*
  * foo.bar.*
  * foo bar baz
  * foo.bar bar.* baz.foo.* */
export type EventTypesdatatype = string;
type _EventTypesdatatype = Primitive._string;

/** Describes the processor execution mode for this document, being
  * either "lax" or "strict". */
export type Exmodedatatype = ("lax" | "strict");
interface _Exmodedatatype extends Primitive._string { content: Exmodedatatype; }

export type HistoryTypedatatype = ("shallow" | "deep");
interface _HistoryTypedatatype extends Primitive._string { content: HistoryTypedatatype; }

/** Non-negative integer */
export type Integerdatatype = number;
type _Integerdatatype = Primitive._number;

interface _InvokeProxyType extends BaseType {
	invoke?: scxmlinvoketype;
	registerEvent?: scxmleventmapper;
}
interface InvokeProxyType extends _InvokeProxyType { constructor: { new(): InvokeProxyType }; }

/** Location language is expression
  * identifying a location in the datamodel. */
export type LocLangdatatype = string;
type _LocLangdatatype = Primitive._string;

interface _scxmlassigntype extends BaseType {
	attr: string;
	expr: string;
	location: string;
	type: AssignTypedatatype;
}
export interface scxmlassigntype extends _scxmlassigntype { constructor: { new(): scxmlassigntype }; }
export var scxmlassigntype: { new(): scxmlassigntype };

interface _scxmlcanceltype extends BaseType {
	sendid: string;
	sendidexpr: string;
}
export interface scxmlcanceltype extends _scxmlcanceltype { constructor: { new(): scxmlcanceltype }; }
export var scxmlcanceltype: { new(): scxmlcanceltype };

interface _scxmlcontenttype extends BaseType {
	expr: string;
}
export interface scxmlcontenttype extends _scxmlcontenttype { constructor: { new(): scxmlcontenttype }; }
export var scxmlcontenttype: { new(): scxmlcontenttype };

interface _scxmldatamodeltype extends BaseType {
	data?: scxmldatatype[];
}
export interface scxmldatamodeltype extends _scxmldatamodeltype { constructor: { new(): scxmldatamodeltype }; }
export var scxmldatamodeltype: { new(): scxmldatamodeltype };

interface _scxmldatatype extends BaseType {
	expr: string;
	id: string;
	src: string;
}
export interface scxmldatatype extends _scxmldatatype { constructor: { new(): scxmldatatype }; }
export var scxmldatatype: { new(): scxmldatatype };

interface _scxmldonedatatype extends BaseType {
	content?: scxmlcontenttype;
	param?: scxmlparamtype[];
}
export interface scxmldonedatatype extends _scxmldonedatatype { constructor: { new(): scxmldonedatatype }; }
export var scxmldonedatatype: { new(): scxmldonedatatype };

interface _scxmlelseiftype extends BaseType {
	cond: string;
}
export interface scxmlelseiftype extends _scxmlelseiftype { constructor: { new(): scxmlelseiftype }; }
export var scxmlelseiftype: { new(): scxmlelseiftype };

interface _scxmlelsetype extends BaseType {}
export interface scxmlelsetype extends _scxmlelsetype { constructor: { new(): scxmlelsetype }; }
export var scxmlelsetype: { new(): scxmlelsetype };

interface _scxmleventmapper extends _scxmleventmapperrestrict {
	event: string;
}
export interface scxmleventmapper extends _scxmleventmapper { constructor: { new(): scxmleventmapper }; }
export var scxmleventmapper: { new(): scxmleventmapper };

interface _scxmleventmapperrestrict extends _scxmlinvoketype {}
export interface scxmleventmapperrestrict extends _scxmleventmapperrestrict { constructor: { new(): scxmleventmapperrestrict }; }
export var scxmleventmapperrestrict: { new(): scxmleventmapperrestrict };

interface _scxmlfinalizetype extends BaseType {
	assign?: scxmlassigntype[];
	cancel?: scxmlcanceltype[];
	foreach?: scxmlforeachtype[];
	if?: scxmliftype[];
	log?: scxmllogtype[];
	raise?: scxmlraisetype[];
	script?: scxmlscripttype[];
	send?: scxmlsendtype[];
}
export interface scxmlfinalizetype extends _scxmlfinalizetype { constructor: { new(): scxmlfinalizetype }; }
export var scxmlfinalizetype: { new(): scxmlfinalizetype };

interface _scxmlfinaltype extends BaseType {
	id: string;
	outcome: string;
	donedata?: scxmldonedatatype[];
	onentry?: scxmlonentrytype[];
	onexit?: scxmlonexittype[];
}
export interface scxmlfinaltype extends _scxmlfinaltype { constructor: { new(): scxmlfinaltype }; }
export var scxmlfinaltype: { new(): scxmlfinaltype };

interface _scxmlforeachtype extends BaseType {
	array: string;
	index: string;
	item: string;
	assign?: scxmlassigntype[];
	cancel?: scxmlcanceltype[];
	foreach?: scxmlforeachtype[];
	if?: scxmliftype[];
	log?: scxmllogtype[];
	raise?: scxmlraisetype[];
	script?: scxmlscripttype[];
	send?: scxmlsendtype[];
}
export interface scxmlforeachtype extends _scxmlforeachtype { constructor: { new(): scxmlforeachtype }; }
export var scxmlforeachtype: { new(): scxmlforeachtype };

interface _scxmlhistorytype extends BaseType {
	id: string;
	type: HistoryTypedatatype;
	transition: scxmltransitiontype;
}
export interface scxmlhistorytype extends _scxmlhistorytype { constructor: { new(): scxmlhistorytype }; }
export var scxmlhistorytype: { new(): scxmlhistorytype };

interface _scxmliftype extends BaseType {
	cond: string;
	assign?: scxmlassigntype[];
	cancel?: scxmlcanceltype[];
	else?: scxmlelsetype;
	elseif?: scxmlelseiftype;
	foreach?: scxmlforeachtype[];
	if?: scxmliftype[];
	log?: scxmllogtype[];
	raise?: scxmlraisetype[];
	script?: scxmlscripttype[];
	send?: scxmlsendtype[];
}
export interface scxmliftype extends _scxmliftype { constructor: { new(): scxmliftype }; }
export var scxmliftype: { new(): scxmliftype };

interface _scxmlinitialtype extends BaseType {
	transition: scxmltransitiontype;
}
export interface scxmlinitialtype extends _scxmlinitialtype { constructor: { new(): scxmlinitialtype }; }
export var scxmlinitialtype: { new(): scxmlinitialtype };

interface _scxmlinvoketype extends BaseType {
	autoforward?: Booleandatatype;
	id: string;
	idlocation: string;
	namelist: string;
	src: string;
	srcexpr: string;
	type: string;
	typeexpr: string;
	content?: scxmlcontenttype[];
	finalize?: scxmlfinalizetype[];
	param?: scxmlparamtype[];
}
export interface scxmlinvoketype extends _scxmlinvoketype { constructor: { new(): scxmlinvoketype }; }
export var scxmlinvoketype: { new(): scxmlinvoketype };

interface _scxmllogtype extends BaseType {
	expr: string;
	label: string;
}
export interface scxmllogtype extends _scxmllogtype { constructor: { new(): scxmllogtype }; }
export var scxmllogtype: { new(): scxmllogtype };

interface _scxmlonentrytype extends BaseType {
	assign?: scxmlassigntype[];
	cancel?: scxmlcanceltype[];
	foreach?: scxmlforeachtype[];
	if?: scxmliftype[];
	log?: scxmllogtype[];
	raise?: scxmlraisetype[];
	script?: scxmlscripttype[];
	send?: scxmlsendtype[];
}
export interface scxmlonentrytype extends _scxmlonentrytype { constructor: { new(): scxmlonentrytype }; }
export var scxmlonentrytype: { new(): scxmlonentrytype };

interface _scxmlonexittype extends BaseType {
	assign?: scxmlassigntype[];
	cancel?: scxmlcanceltype[];
	foreach?: scxmlforeachtype[];
	if?: scxmliftype[];
	log?: scxmllogtype[];
	raise?: scxmlraisetype[];
	script?: scxmlscripttype[];
	send?: scxmlsendtype[];
}
export interface scxmlonexittype extends _scxmlonexittype { constructor: { new(): scxmlonexittype }; }
export var scxmlonexittype: { new(): scxmlonexittype };

interface _scxmlparalleltype extends BaseType {
	id: string;
	datamodel?: scxmldatamodeltype[];
	history?: scxmlhistorytype[];
	invoke?: InvokeProxyType[];
	onentry?: scxmlonentrytype[];
	onexit?: scxmlonexittype[];
	parallel?: scxmlparalleltype[];
	state?: scxmlstatetype[];
	transition?: scxmltransitiontype[];
}
export interface scxmlparalleltype extends _scxmlparalleltype { constructor: { new(): scxmlparalleltype }; }
export var scxmlparalleltype: { new(): scxmlparalleltype };

interface _scxmlparamtype extends BaseType {
	expr: string;
	location: string;
	name: string;
}
export interface scxmlparamtype extends _scxmlparamtype { constructor: { new(): scxmlparamtype }; }
export var scxmlparamtype: { new(): scxmlparamtype };

interface _scxmlraisetype extends BaseType {
	event: string;
}
export interface scxmlraisetype extends _scxmlraisetype { constructor: { new(): scxmlraisetype }; }
export var scxmlraisetype: { new(): scxmlraisetype };

interface _scxmlscripttype extends BaseType {
	src: string;
}
export interface scxmlscripttype extends _scxmlscripttype { constructor: { new(): scxmlscripttype }; }
export var scxmlscripttype: { new(): scxmlscripttype };

interface _scxmlscxmltype extends BaseType {
	binding: Bindingdatatype;
	$datamodel?: string;
	exmode: Exmodedatatype;
	initial: string;
	name: string;
	version: number;
	datamodel?: scxmldatamodeltype[];
	final?: scxmlfinaltype[];
	invoke?: InvokeProxyType[];
	parallel?: scxmlparalleltype[];
	script?: scxmlscripttype[];
	state?: scxmlstatetype[];
}
export interface scxmlscxmltype extends _scxmlscxmltype { constructor: { new(): scxmlscxmltype }; }
export var scxmlscxmltype: { new(): scxmlscxmltype };

interface _scxmlsendtype extends BaseType {
	delay: string;
	delayexpr: string;
	event: string;
	eventexpr: string;
	id: string;
	idlocation: string;
	namelist: string;
	target: string;
	targetexpr: string;
	type: string;
	typeexpr: string;
	content?: scxmlcontenttype[];
	param?: scxmlparamtype[];
}
export interface scxmlsendtype extends _scxmlsendtype { constructor: { new(): scxmlsendtype }; }
export var scxmlsendtype: { new(): scxmlsendtype };

interface _scxmlstatetype extends BaseType {
	id: string;
	$initial: string;
	datamodel?: scxmldatamodeltype[];
	final?: scxmlfinaltype[];
	history?: scxmlhistorytype[];
	initial?: scxmlinitialtype[];
	invoke?: InvokeProxyType[];
	onentry?: scxmlonentrytype[];
	onexit?: scxmlonexittype[];
	parallel?: scxmlparalleltype[];
	state?: scxmlstatetype[];
	transition?: scxmltransitiontype[];
}
export interface scxmlstatetype extends _scxmlstatetype { constructor: { new(): scxmlstatetype }; }
export var scxmlstatetype: { new(): scxmlstatetype };

interface _scxmltransitiontype extends BaseType {
	cond: string;
	event: string;
	target: string;
	type: TransitionTypedatatype;
	assign?: scxmlassigntype[];
	cancel?: scxmlcanceltype[];
	foreach?: scxmlforeachtype[];
	if?: scxmliftype[];
	log?: scxmllogtype[];
	raise?: scxmlraisetype[];
	script?: scxmlscripttype[];
	send?: scxmlsendtype[];
}
export interface scxmltransitiontype extends _scxmltransitiontype { constructor: { new(): scxmltransitiontype }; }
export var scxmltransitiontype: { new(): scxmltransitiontype };

/** The type of the transition i.e. internal or external. */
export type TransitionTypedatatype = ("internal" | "external");
interface _TransitionTypedatatype extends Primitive._string { content: TransitionTypedatatype; }

/** The xsd:anyURI type and thus URI references in SCXML
  * documents may contain a wide array of international
  * characters. Implementers should reference RFC 3987 and
  * the "Character Model for the World Wide Web 1.0:
  * Resource Identifiers" in order to provide appropriate
  * support for these characters in VoiceXML documents and
  * when processing values of this type or mapping them to
  * URIs. */
export type URIdatatype = string;
type _URIdatatype = Primitive._string;

/** Value language is expression
  * return a value. */
export type ValueLangdatatype = string;
type _ValueLangdatatype = Primitive._string;

export interface document extends BaseType {
	assign: scxmlassigntype;
	cancel: scxmlcanceltype;
	content: scxmlcontenttype;
	data: scxmldatatype;
	datamodel: scxmldatamodeltype;
	donedata: scxmldonedatatype;
	else: scxmlelsetype;
	elseif: scxmlelseiftype;
	final: scxmlfinaltype;
	finalize: scxmlfinalizetype;
	foreach: scxmlforeachtype;
	history: scxmlhistorytype;
	if: scxmliftype;
	initial: scxmlinitialtype;
	log: scxmllogtype;
	onentry: scxmlonentrytype;
	onexit: scxmlonexittype;
	parallel: scxmlparalleltype;
	param: scxmlparamtype;
	raise: scxmlraisetype;
	registerEvent: scxmleventmapper;
	script: scxmlscripttype;
	scxml: scxmlscxmltype;
	send: scxmlsendtype;
	state: scxmlstatetype;
	transition: scxmltransitiontype;
}
export var document: document;
