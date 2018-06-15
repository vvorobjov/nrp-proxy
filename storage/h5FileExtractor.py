import sys
import os
sys.path.insert(0,os.path.join(os.environ['HBP'],'nrpBackendProxy','proxy_virtualenv','lib','python2.7','site-packages'))
from mock_import import mock_import
import importlib

class MockH5py():
    h5file = None
    def File(self,a,b):
        self.h5file = a
        raise Exception()

mock_instance = MockH5py()
sys.modules['h5py'] = mock_instance
with mock_import(do_not_mock=['os', sys.argv[1],'h5py']):
    try:
        sys.path.insert(0,os.path.join(os.environ['HBP'],'Models','brain_model'))
        importlib.import_module(sys.argv[1])
        sys.path.remove(os.path.join(os.environ['HBP'],'Models','brain_model'))
    except Exception as e :
        print e

#the stdout can be used already from within the python script so we output to the stderr instead
sys.stderr.write(os.path.basename(mock_instance.h5file))

