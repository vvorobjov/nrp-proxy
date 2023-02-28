import nest
import nest.voltage_trace
from nrp_core.engines.nest_json import RegisterDataPack, CreateDataPack

nest.set_verbosity('M_WARNING')
nest.ResetKernel()

neurons = nest.Create('iaf_psc_alpha',3)

dcl = CreateDataPack("dcl", "dc_generator")
dcr = CreateDataPack("dcr", "dc_generator")
nest.SetStatus(dcl, {"amplitude": 0.0})
nest.SetStatus(dcr, {"amplitude": 0.0})

nest.Connect(dcl, neurons[0], 'all_to_all',
                    {'weight': -500., 'delay': 1.0})
nest.Connect(dcr, neurons[1], 'all_to_all',
                    {'weight': 500., 'delay': 1.0})
spikerecorderr = nest.Create("spike_recorder")
spikerecorderl = nest.Create("spike_recorder")
RegisterDataPack('spikerecorderr', spikerecorderr)
RegisterDataPack('spikerecorderl', spikerecorderl)

nest.Connect(neurons[1], spikerecorderr, 'all_to_all')
nest.Connect(neurons[0], spikerecorderl, 'all_to_all')



