from nrp_core import *
from nrp_core.data.nrp_json import *

@EngineDataPack(keyword='observation', id=DataPackIdentifier('observation', 'gym_simulator'))
@TransceiverFunction("nest_controller")
def transceiver_function(observation):
    dcl = JsonDataPack("dcl", "nest_controller")
    dcr = JsonDataPack("dcr", "nest_controller")

    the_obsver = observation.data["observation"]
    dcl.data["amplitude"] = the_obsver[1]*10000.0
    dcr.data["amplitude"] = the_obsver[1]*10000.0

    spikerecorderr = JsonDataPack("spikerecorderr", "nest_controller")
    spikerecorderl = JsonDataPack("spikerecorderl", "nest_controller")

    spikerecorderr.data["n_events"] = 0
    spikerecorderl.data["n_events"] = 0
    return [ dcl, dcr, spikerecorderr, spikerecorderl]
